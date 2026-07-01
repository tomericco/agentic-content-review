# Comment Replies Design

## Goal

Let people discuss a comment before a review is decided. A review link has no login — "anyone with the URL can access it" (per `/docs`) — and the link is already meant to be shared with "you and your team." Today, comments are a flat list with no way to respond to one another. This adds threaded replies to comments, visible both on the review page and in the agent-facing summary.

## Scope

- Fully nested reply threads (a reply can itself be replied to, to arbitrary depth).
- Replies inherit their thread root's text anchor — they don't anchor to their own span of text.
- Replies are visible to the agent: included in `GET /api/amend/[slug]/summary` (the only agent-facing surface that's actually wired up today — see "Explicitly out of scope").
- A lightweight, auto-generated display name per browser (no auth) so threaded replies read as a real conversation instead of unattributed bubbles.

## Data model

The existing `comments` table (`supabase/migrations/0001_init.sql`):

```sql
create table comments (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references reviews(id) on delete cascade,
  body         text not null,
  anchor_start integer not null,
  anchor_end   integer not null,
  anchor_text  text not null,
  created_at   timestamptz not null default now()
);
```

New migration `supabase/migrations/0002_comment_replies.sql`:

```sql
alter table comments
  add column parent_id uuid references comments(id) on delete cascade,
  add column author_name text,
  alter column anchor_start drop not null,
  alter column anchor_end drop not null,
  alter column anchor_text drop not null;

-- Enforce the invariant: a top-level comment has a full anchor and no parent;
-- a reply has a parent and no anchor of its own.
alter table comments add constraint comments_anchor_xor_parent check (
  (parent_id is null and anchor_start is not null and anchor_end is not null and anchor_text is not null)
  or
  (parent_id is not null and anchor_start is null and anchor_end is null and anchor_text is null)
);

create index comments_parent_id_idx on comments(parent_id);
```

- `parent_id` — self-referencing, nullable. `null` for a top-level comment (anchored to text); non-null for a reply (attached to another comment, top-level or reply). `ON DELETE CASCADE` means deleting a comment removes its entire reply subtree, avoiding orphaned rows.
- `author_name` — nullable text, max 60 characters (validated at the API layer, matching the auto-generated "Adjective Animal" format with room for a user-edited name). Applies uniformly to top-level comments and replies since both are rows in the same table; not required by the API.

`Comment` type (`src/types/index.ts`) gains:

```ts
export interface Comment {
  id: string
  review_id: string
  parent_id: string | null
  body: string
  anchor_start: number | null
  anchor_end: number | null
  anchor_text: string | null
  author_name: string | null
  created_at: string
}
```

`anchor_start`/`anchor_end`/`anchor_text` become nullable: `null` for replies, populated for top-level comments (as today).

## API

Reuse the existing `POST /api/amend/[slug]/comment` endpoint for both top-level comments and replies — no new route.

- Request body gains two optional fields: `parent_id` and `author_name`.
- When `parent_id` is **absent**: behavior is unchanged from today — `body`, `anchor_text`, `anchor_start`, `anchor_end` are required.
- When `parent_id` is **present**: `anchor_text`/`anchor_start`/`anchor_end` are not required (and ignored if sent) — the reply is stored with `anchor_start`/`anchor_end`/`anchor_text` all `null`. The route looks up the parent comment by id and:
  - 404 `code: 'parent_comment_not_found'` if no comment with that id exists.
  - 400 `code: 'parent_comment_wrong_review'` if the parent comment belongs to a different review than `slug` resolves to (prevents cross-review reply injection).
- `author_name` is optional in both cases; trimmed, and rejected with 400 `code: 'author_name_too_long'` if over 60 characters (matching the DB migration's expectations — see Data model). `null`/absent is stored as `null`.
- The existing "review already decided → 409" check applies identically to replies (you can't add a comment or a reply after the review is decided).

`PATCH` / `DELETE /api/amend/[slug]/comment/[commentId]` are unchanged — they already operate generically on any comment row by id, so they work on replies without modification. Deleting a comment with replies cascades via the DB FK, not application code.

`getCommentsByReviewId` is unchanged: still returns a flat list ordered by `created_at` ascending. Nesting is a read-time concern for consumers, not the DB layer.

## Tree building (shared)

New `src/lib/commentTree.ts`:

```ts
export interface CommentNode extends Comment {
  replies: CommentNode[]
}

export function buildCommentTree(comments: Comment[]): CommentNode[]
```

Groups the flat list by `parent_id` in one pass, then recursively attaches children to their parent, returning only the roots (`parent_id === null`) with `replies` populated at every depth. Used by both the client UI (`MarginalComments`) and the server-side summary builder (`buildSummary`) — one definition of "how a thread nests," not two.

Defensive behavior: if a comment's `parent_id` points to a row that isn't in the given list (shouldn't happen given the FK, but the function shouldn't crash if it does), that comment is treated as a root rather than dropped.

## Summary output (agent-facing)

`buildSummary()` (`src/lib/summary.ts`) is rewritten to walk `buildCommentTree(comments)` and render each root followed by its replies, indented per depth with `↳`, including author name when present:

```
## Comments (3)

1. On: "we dominated"
   → "Consider softening the tone" — Quick Falcon
     ↳ "Agreed, will rewrite" — Silent Otter
       ↳ "Thanks!" — Quick Falcon
```

A comment/reply with no `author_name` renders without the `— Name` suffix (same as today's format for the top-level case).

**Explicitly out of scope:** `webhook_url` is documented in `/docs` as "URL to POST the decision to when reviewer decides," but while implementing this feature I confirmed the codebase never actually POSTs to it anywhere — there's no webhook delivery code at all today. That's a pre-existing gap unrelated to comment replies, and this design does not add webhook delivery. `GET /api/amend/[slug]/summary` is the only agent-facing surface that actually exists, and is the one this design updates.

## UI

### Display name

On first visit to a review page, generate a readable random name client-side in the same style as slug generation (adjective + animal, e.g. "Quick Falcon") and store it in `localStorage` under `amend:display_name`. This name is sent as `author_name` automatically on every comment/reply — no manual entry required. A small "commenting as **Quick Falcon** · edit" affordance near the comment/reply composer lets someone change it, updating `localStorage` (scoped to the browser, not the review — the same name follows a person across reviews they visit from that browser).

### `CommentCard` (in `MarginalComments.tsx`)

Becomes recursive:

- Renders its own body (unchanged: edit/delete actions, timestamp), now also showing `author_name` as a small label when present.
- Adds a "Reply" action. Clicking it reveals an inline textarea directly under the comment (reusing the existing edit-textarea styling and `Cmd/Ctrl+Enter` submit / `Escape` cancel pattern already used for editing).
- If the comment has `replies`, renders them as nested `CommentCard`s, indented under it, each capable of being replied to in turn (arbitrary depth).
- Edit/delete continue to work per-row exactly as today, since replies are just comment rows.

### Positioning fix (necessary, not optional)

`MarginalComments`'s current layout logic assumes a fixed 88px minimum vertical gap between top-level comment cards when stacking them next to the article. With nested threads, a card's rendered height becomes highly variable (a comment with a 4-deep reply thread is much taller than a lone comment). This is replaced with measuring each top-level card's actual rendered height via `ResizeObserver` and stacking subsequent cards based on real measured heights, not the fixed constant.

### Explicitly out of scope

- No collapse/expand for long threads — they render in full. Worth revisiting later if threads get unwieldy in practice, but not a day-one requirement.
- No real-time/collaborative updates (e.g. WebSocket) — replies follow the same optimistic-local-state + REST pattern already used for comments.
- No webhook delivery (see above — pre-existing gap, unrelated).

## Testing

- `commentTree.test.ts`: flat-to-tree conversion, multi-level nesting, multiple roots, defensive handling of an orphaned `parent_id`.
- `comment/route.ts` (or its test equivalent): creating a reply with `parent_id` (anchor fields optional/ignored), rejecting a `parent_id` from another review, rejecting a nonexistent `parent_id`, unchanged behavior for top-level comments (no `parent_id`).
- `summary.test.ts`: nested rendering format, author name present/absent, multi-level indentation.
