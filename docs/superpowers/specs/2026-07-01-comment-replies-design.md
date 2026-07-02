# Comment Replies Design

## Goal

Let people discuss a comment before a review is decided. A review link has no login — "anyone with the URL can access it" (per `/docs`) — and the link is already meant to be shared with "you and your team." Today, comments are a flat list with no way to respond to one another. This adds threaded replies to comments, visible both on the review page and in the agent-facing summary.

## Scope

- Reply-to-reply is supported at the data level (a reply's `parent_id` can point to another reply, to arbitrary depth) — but display is **flat, not nested**: every reply in a thread, regardless of which specific comment/reply it was posted in response to, renders as one chronological list directly under the thread's root comment. Replying to a reply doesn't visually indent further; it just adds another entry to that same flat list. This applies both on the review page and in the agent-facing summary.
- Replies inherit their thread root's text anchor — they don't anchor to their own span of text.
- Replies are visible to the agent: included in `GET /api/amend/[slug]/summary` (the only agent-facing surface that's actually wired up today — see "Explicitly out of scope").
- A lightweight, auto-generated display name per browser (no auth) so replies read as a real conversation instead of unattributed bubbles.

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

## Thread grouping (shared)

New `src/lib/commentTree.ts`:

```ts
export interface CommentThread {
  root: Comment
  replies: Comment[]
}

export function buildCommentThreads(comments: Comment[]): CommentThread[]
```

For each top-level comment (`parent_id === null`), collects **all** of its descendants at any depth — a reply to a reply still belongs to the same root's thread — into a single flat `replies` array sorted by `created_at` ascending. There is no nested `CommentNode`/`replies-of-replies` structure; a thread is always exactly two levels for display purposes: one root, one flat list under it. `parent_id` itself still records the true reply-to-reply relationship in the data (in case a nested UI is ever wanted later), but nothing reads that chain for rendering — grouping only cares "which root does this comment ultimately belong to."

Used by both the client UI (`MarginalComments`) and the server-side summary builder (`buildSummary`) — one definition of "which replies belong to which thread," not two.

Defensive behavior: if a comment's `parent_id` points to a row that isn't in the given list (shouldn't happen given the FK, but the function shouldn't crash if it does), that comment is treated as its own root rather than dropped.

## Summary output (agent-facing)

`buildSummary()` (`src/lib/summary.ts`) is rewritten to walk `buildCommentThreads(comments)` and render each root followed by its flat list of replies (uniform `↳` prefix, no depth-based indentation), including author name when present:

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

Stays a single component, not recursive — it now renders a root comment plus a flat list of reply rows:

- Root comment renders as today (edit/delete actions, timestamp), now also showing `author_name` as a small label when present.
- Below it, each entry in `thread.replies` (from `buildCommentThreads`) renders as a lighter-weight row: body, author name, timestamp, and its own edit/delete actions (since it's still an independently editable/deletable comment row) — but no further "reply" indentation under it.
- Every row in the thread (the root, and each reply) has a "Reply" action. Clicking it on *any* row reveals the same inline textarea (reusing the existing edit-textarea styling and `Cmd/Ctrl+Enter` submit / `Escape` cancel pattern already used for editing), always appended visually at the end of the flat reply list — clicking "Reply" on an earlier reply sets that reply's id as `parent_id` on the new comment (preserving the real relationship in the data) but the new reply still appears at the bottom of the flat list, not inserted next to the one it was replying to.

### Positioning fix (necessary, not optional)

`MarginalComments`'s current layout logic assumes a fixed 88px minimum vertical gap between top-level comment cards when stacking them next to the article. With reply threads, a card's rendered height becomes highly variable (a comment with ten replies is much taller than a lone comment). This is replaced with measuring each card's actual rendered height via `ResizeObserver` and stacking subsequent cards based on real measured heights, not the fixed constant.

### Explicitly out of scope

- No collapse/expand for long threads — they render in full. Worth revisiting later if threads get unwieldy in practice, but not a day-one requirement.
- No real-time/collaborative updates (e.g. WebSocket) — replies follow the same optimistic-local-state + REST pattern already used for comments.
- No webhook delivery (see above — pre-existing gap, unrelated).

## Testing

- `commentTree.test.ts`: grouping a flat list into threads, a reply-to-a-reply still lands in its root's flat `replies` list (not nested), multiple independent roots, defensive handling of an orphaned `parent_id`.
- `comment/route.ts` (or its test equivalent): creating a reply with `parent_id` (anchor fields optional/ignored), replying to a reply (`parent_id` pointing at a non-root comment) still resolves to the correct thread, rejecting a `parent_id` from another review, rejecting a nonexistent `parent_id`, unchanged behavior for top-level comments (no `parent_id`).
- `summary.test.ts`: flat reply-list rendering format, author name present/absent, a reply-to-a-reply appears in the same flat list as a reply-to-root.
