# Review Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every resubmit creates a new revision instead of overwriting; reviewers browse revisions (content + their comments, read-only) with header arrows and keyboard left/right, with a smooth transition; latest revision shows by default.

**Architecture:** A new `revisions` table holds one content snapshot per round; `comments.revision_id` ties each comment to its round. `reviews.content` stays the canonical *latest* content so existing reads keep working. The review page loads all revisions + all comments up front; switching revisions is pure client state in `ReviewShell` (no fetch), which is what makes the animated transition possible.

**Tech Stack:** Next.js App Router (see Global Constraints), Supabase (`@supabase/supabase-js`), Tiptap editor, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-11-review-revisions-design.md`

## Global Constraints

- **This is NOT the Next.js you know** (per AGENTS.md): before writing any route/page code, read the relevant guide in `node_modules/next/dist/docs/`. Follow what the docs say over your training data.
- Decision state (`status`, `changes_requested`, `final_content`, `decided_at`) stays on `reviews` and is NOT versioned.
- Old revisions are strictly read-only: no new comments, edits, replies, or decisions.
- Agent-facing summary is scoped to the **latest** revision only, plus a `**Revision:** N` line.
- Error code for commenting on a non-latest revision: `revision_not_latest`, HTTP 409.
- On resubmit, insert the revision row **first**, then update the review row (so a failed insert leaves the review untouched).
- Deploy ordering: `git push` to main auto-deploys via Vercel. The DB migration (Task 1) must be applied to production **before** the code from Tasks 3+ is pushed, or `getRevisionsByReviewId` will hit a missing table.
- Run `npm run test` and `npx tsc --noEmit` before every commit.

---

### Task 1: Schema — revisions table, types, dev seed

**Files:**
- Create: `supabase/migrations/0004_revisions.sql`
- Modify: `src/types/index.ts`
- Modify: `scripts/seed-dev.mjs`

**Interfaces:**
- Produces: `revisions` table; `Revision` TypeScript interface; `Comment.revision_id: string`. Every later task relies on these.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_revisions.sql`:

```sql
create table revisions (
  id              uuid primary key default gen_random_uuid(),
  review_id       uuid not null references reviews(id) on delete cascade,
  revision_number integer not null,          -- 1, 2, 3...
  content         text not null,
  created_at      timestamptz not null default now(),
  unique (review_id, revision_number)
);

create index revisions_review_id_idx on revisions(review_id);

-- Backfill: every existing review becomes its own revision 1.
insert into revisions (review_id, revision_number, content, created_at)
select id, 1, content, created_at from reviews;

-- Tie comments to revisions; existing comments belong to the backfilled revision 1.
alter table comments add column revision_id uuid references revisions(id) on delete cascade;

update comments c
set revision_id = r.id
from revisions r
where r.review_id = c.review_id;

alter table comments alter column revision_id set not null;
```

(The spec mentions keeping `revision_id` nullable for a two-step migration; since backfill happens inside this same migration, NOT NULL is safe and stricter — intentional.)

- [ ] **Step 2: Add the `Revision` type and extend `Comment`**

In `src/types/index.ts`, add after the `Review` interface:

```ts
export interface Revision {
  id: string
  review_id: string
  revision_number: number
  content: string
  created_at: string
}
```

And add `revision_id: string` to the `Comment` interface (after `review_id`):

```ts
export interface Comment {
  id: string
  review_id: string
  revision_id: string
  parent_id: string | null
  body: string
  anchor_start: number | null
  anchor_end: number | null
  anchor_text: string | null
  author_name: string | null
  created_at: string
}
```

- [ ] **Step 3: Update the dev seed to create a revision**

In `scripts/seed-dev.mjs`, the sample review insert must also create revision 1 (the review page will require it once Task 5 lands). Replace the insert block (currently `const { error: insertError } = await supabase.from('reviews').insert({...})` through the success log) with:

```js
  const { data: created, error: insertError } = await supabase
    .from('reviews')
    .insert({
      slug: SAMPLE_SLUG,
      title: 'Dev sample review',
      content: SAMPLE_CONTENT,
      content_type: 'long_form',
      context: 'Seeded by scripts/seed-dev.mjs — safe to comment on, edit, or decide freely.',
      access: 'comment_and_edit',
      agent_model: null,
      author_email: 'dev-seed@example.com',
      reviewer_email: 'dev-seed@example.com',
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[seed-dev] Failed to create sample review:', insertError.message)
    return
  }

  const { error: revisionError } = await supabase.from('revisions').insert({
    review_id: created.id,
    revision_number: 1,
    content: SAMPLE_CONTENT,
  })

  if (revisionError) {
    console.error('[seed-dev] Failed to create sample revision:', revisionError.message)
    return
  }

  console.log(`[seed-dev] Created sample review at /${SAMPLE_SLUG}`)
```

- [ ] **Step 4: Apply the migration to the dev database**

Apply `0004_revisions.sql` the same way migrations 0001–0003 were applied (Supabase CLI `supabase db push` if the project is linked, otherwise paste into the Supabase dashboard SQL editor for the dev project). **This is a human-in-the-loop step — if you cannot apply it, stop and ask the user to run it before continuing.**

Verify: in the dev DB, `select count(*) from revisions;` returns one row per existing review, and `select count(*) from comments where revision_id is null;` returns 0.

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npm run test`
Expected: PASS (nothing consumes the new fields yet).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_revisions.sql src/types/index.ts scripts/seed-dev.mjs
git commit -m "feat: add revisions table, Revision type, comment revision link"
```

---

### Task 2: Summary — revision line (TDD)

**Files:**
- Modify: `src/lib/summary.ts`
- Test: `src/lib/summary.test.ts`

**Interfaces:**
- Produces: `buildSummary(review: Review, comments: Comment[], resubmitUrl?: string, revisionNumber?: number): string` — Task 3's summary route passes the 4th argument.

- [ ] **Step 1: Write the failing tests**

In `src/lib/summary.test.ts`, note the existing `comments` fixture gains `revision_id: 'rev1'` (Task 1 made it required on the `Comment` type — add it to every `Comment` literal in this file). Then add inside `describe('buildSummary', ...)`:

```ts
  it('includes the revision number when provided', () => {
    const s = buildSummary(baseReview, [], undefined, 2)
    expect(s).toContain('**Revision:** 2')
  })

  it('omits the revision line when no revision number is provided', () => {
    const s = buildSummary(baseReview, [])
    expect(s).not.toContain('**Revision:**')
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- summary`
Expected: FAIL — `includes the revision number when provided` (buildSummary ignores a 4th argument, so no `**Revision:**` line).

- [ ] **Step 3: Implement**

In `src/lib/summary.ts`, change the signature and add the line right after the Status line:

```ts
export function buildSummary(review: Review, comments: Comment[], resubmitUrl?: string, revisionNumber?: number): string {
  const lines: string[] = []

  lines.push(`# Amend Summary: ${review.title}`, '')
  lines.push(`**Status:** ${STATUS_LABELS[review.status] ?? review.status}`)

  if (revisionNumber !== undefined) {
    lines.push(`**Revision:** ${revisionNumber}`)
  }

  if (review.decided_at) {
```

(Rest of the function unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/summary.ts src/lib/summary.test.ts
git commit -m "feat: add revision number line to agent summary"
```

---

### Task 3: DB helpers + API routes

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/amend/[slug]/resubmit/route.ts`
- Modify: `src/app/api/amend/[slug]/comment/route.ts`
- Modify: `src/app/api/amend/[slug]/summary/route.ts`
- Modify: `src/app/docs/page.tsx` (resubmit response example)

**Interfaces:**
- Consumes: `Revision` type, `buildSummary(..., revisionNumber?)` from Tasks 1–2.
- Produces (Tasks 5–6 consume these exact signatures):
  - `createRevision(reviewId: string, revisionNumber: number, content: string): Promise<Revision>`
  - `getRevisionsByReviewId(reviewId: string): Promise<Revision[]>` — ordered by `revision_number` ascending
  - `getLatestRevision(reviewId: string): Promise<Revision | null>`
  - `getCommentsByRevisionId(revisionId: string): Promise<Comment[]>` — ordered by `created_at` ascending
  - `resubmitReview(id: string, content: string): Promise<{ review: Review; revision: Revision }>`
  - `createComment(reviewId: string, revisionId: string, input: CommentInput): Promise<Comment>`
  - Comment API: optional `revision_id` in POST body; 409 `{ code: 'revision_not_latest' }` when it isn't the latest revision's id.
  - Resubmit API response gains `revision: <number>`.

- [ ] **Step 1: Add revision helpers to `src/lib/db.ts`**

Add `Revision` to the type import (`import type { Review, Comment, Revision } from '@/types'`), then add after `getReviewBySlug`:

```ts
export async function createRevision(reviewId: string, revisionNumber: number, content: string): Promise<Revision> {
  const { data, error } = await supabase
    .from('revisions')
    .insert({ review_id: reviewId, revision_number: revisionNumber, content })
    .select()
    .single()

  if (error) throw new Error(`DB error creating revision: ${error.message}`)
  return data as Revision
}

export async function getRevisionsByReviewId(reviewId: string): Promise<Revision[]> {
  const { data, error } = await supabase
    .from('revisions')
    .select()
    .eq('review_id', reviewId)
    .order('revision_number', { ascending: true })

  if (error) throw new Error(`DB error fetching revisions: ${error.message}`)
  return (data ?? []) as Revision[]
}

export async function getLatestRevision(reviewId: string): Promise<Revision | null> {
  const { data, error } = await supabase
    .from('revisions')
    .select()
    .eq('review_id', reviewId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`DB error fetching latest revision: ${error.message}`)
  return data as Revision | null
}

export async function getCommentsByRevisionId(revisionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select()
    .eq('revision_id', revisionId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`DB error fetching comments: ${error.message}`)
  return (data ?? []) as Comment[]
}
```

- [ ] **Step 2: Rework `resubmitReview`, `createComment`; delete `deleteCommentsByReviewId`**

Still in `src/lib/db.ts`:

Replace `resubmitReview` with (revision insert FIRST, then review update — a failed insert must leave the review untouched):

```ts
export async function resubmitReview(id: string, content: string): Promise<{ review: Review; revision: Revision }> {
  const latest = await getLatestRevision(id)
  const revision = await createRevision(id, (latest?.revision_number ?? 0) + 1, content)

  const { data, error } = await supabase
    .from('reviews')
    .update({
      content,
      status: 'pending',
      final_content: null,
      changes_requested: null,
      decided_at: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`DB error resubmitting review: ${error.message}`)
  return { review: data as Review, revision }
}
```

Change `createComment` to take the revision id:

```ts
export async function createComment(reviewId: string, revisionId: string, input: CommentInput): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ review_id: reviewId, revision_id: revisionId, ...input })
    .select()
    .single()

  if (error) throw new Error(`DB error creating comment: ${error.message}`)
  return data as Comment
}
```

Delete the `deleteCommentsByReviewId` function and its explanatory comment entirely — comments are now kept per revision.

- [ ] **Step 3: Upload route creates revision 1**

In `src/app/api/upload/route.ts`, add `createRevision` to the db import and create the first revision right after `createReview`:

```ts
    const review = await createReview(validation.data, slug)
    await createRevision(review.id, 1, validation.data.content)
```

- [ ] **Step 4: Resubmit route — keep comments, return revision number**

In `src/app/api/amend/[slug]/resubmit/route.ts`:

- Change the db import to `import { getReviewBySlug, resubmitReview } from '@/lib/db'` (drop `deleteCommentsByReviewId`).
- Replace the resubmit + comment-deletion block:

```ts
    const { review: updated, revision } = await resubmitReview(review.id, content)
```

(Delete the `deleteCommentsByReviewId(review.id)` call and its comment — previous comments now live on their own revision.)

- Add `revision` to the response:

```ts
    return NextResponse.json({
      slug: updated.slug,
      amend_url: `${SITE_URL}/${updated.slug}`,
      summary_url: `${SITE_URL}/api/amend/${updated.slug}/summary`,
      resubmit_url: `${SITE_URL}/api/amend/${updated.slug}/resubmit`,
      status: updated.status,
      revision: revision.revision_number,
    })
```

- [ ] **Step 5: Comment route — attach to latest revision, guard stale targets**

In `src/app/api/amend/[slug]/comment/route.ts`:

- Import `getLatestRevision` alongside the existing db imports.
- After the `review.status !== 'pending'` guard and JSON parsing, resolve the latest revision and guard an explicitly-targeted stale revision:

```ts
    const latest = await getLatestRevision(review.id)
    if (!latest) {
      // Every review has a revision after migration 0004; missing one is a data bug.
      throw new Error(`Review ${review.id} has no revisions`)
    }
    if (typeof b.revision_id === 'string' && b.revision_id !== latest.id) {
      return NextResponse.json({ error: 'Comments can only be added to the latest revision', code: 'revision_not_latest' }, { status: 409 })
    }
```

(Place this right after `const b = body as Record<string, unknown>` and the `!b.body` check.)

- In the reply branch, after the `parent.review_id !== review.id` check, reject replies to comments from older revisions:

```ts
      if (parent.revision_id !== latest.id) {
        return NextResponse.json({ error: 'Comments can only be added to the latest revision', code: 'revision_not_latest' }, { status: 409 })
      }
```

- Update both `createComment` calls to the new signature: `createComment(review.id, latest.id, { ... })`.

- [ ] **Step 6: Summary route — latest revision's comments and number**

In `src/app/api/amend/[slug]/summary/route.ts`, replace the comment fetch + buildSummary call:

```ts
import { getReviewBySlug, getCommentsByReviewId, getCommentsByRevisionId, getLatestRevision } from '@/lib/db'
```

```ts
    const latest = await getLatestRevision(review.id)
    const comments = latest
      ? await getCommentsByRevisionId(latest.id)
      : await getCommentsByReviewId(review.id)
    const resubmitUrl = `${SITE_URL}/api/amend/${review.slug}/resubmit`
    const summary = buildSummary(review, comments, resubmitUrl, latest?.revision_number)
```

- [ ] **Step 7: Scope the decide route's feedback guard to the latest revision**

`src/app/api/decide/route.ts` enforces "requesting changes needs at least one comment or general feedback" by counting `getCommentsByReviewId(review.id)`. Now that old revisions keep their comments, that count would be satisfied by *stale* feedback from a previous round. Scope it to the current revision:

- Change the db import to include the new helpers: `import { getReviewBySlug, updateReviewDecision, getCommentsByRevisionId, getLatestRevision } from '@/lib/db'` (drop `getCommentsByReviewId`).
- Replace the comments fetch:

```ts
    const latest = await getLatestRevision(review.id)
    const comments = latest ? await getCommentsByRevisionId(latest.id) : []
```

(The `notifyAuthor(updated, comments)` call below is commented out; leave it as-is — it now references latest-revision comments, which is also what the author should get if email is re-enabled.)

- [ ] **Step 8: Update the docs page resubmit example**

In `src/app/docs/page.tsx`, add `"revision": 2` to the `RESUBMIT_RESPONSE` constant:

```ts
const RESUBMIT_RESPONSE = `{
  "slug": "abc123",
  "amend_url": "${BASE}/abc123",
  "summary_url": "${BASE}/api/amend/abc123/summary",
  "resubmit_url": "${BASE}/api/amend/abc123/resubmit",
  "status": "pending",
  "revision": 2
}`;
```

- [ ] **Step 9: Typecheck and test**

Run: `npx tsc --noEmit && npm run test`
Expected: PASS. If `tsc` flags other `createComment`/`deleteCommentsByReviewId` callers you missed, fix them now.

(No unit tests for the new db helpers: the existing codebase deliberately has none for `db.ts` — they'd need a live Supabase. The curl round-trip in the next step is this task's behavioral verification, matching the project's pattern.)

- [ ] **Step 10: Manual API verification against the dev DB**

Start the dev server (`npm run dev`), then exercise the full round-trip:

```bash
# 1. Upload
curl -s -X POST http://localhost:3000/api/upload -H 'Content-Type: application/json' \
  -d '{"title":"Rev test","content":"version one","content_type":"long_form","access":"comment_and_edit"}'
# → note the slug, expect 201

# 2. Comment on it (no revision_id — should attach to latest)
curl -s -X POST http://localhost:3000/api/amend/<slug>/comment -H 'Content-Type: application/json' \
  -d '{"body":"first round note","anchor_start":0,"anchor_end":7,"anchor_text":"version"}'
# → 201, response includes revision_id

# 3. Decide (request changes) so resubmit is allowed — slug is a QUERY param
curl -s -X POST 'http://localhost:3000/api/decide?slug=<slug>' -H 'Content-Type: application/json' \
  -d '{"decision":"changes_requested","changes_requested":"softer tone"}'

# 4. Resubmit
curl -s -X PATCH http://localhost:3000/api/amend/<slug>/resubmit -H 'Content-Type: application/json' \
  -d '{"content":"version two"}'
# → expect "revision": 2 in the response

# 5. Summary — expect "**Revision:** 2" and NO first-round comments
curl -s http://localhost:3000/api/amend/<slug>/summary

# 6. Stale-revision guard — POST a comment with the OLD revision_id from step 2
curl -s -X POST http://localhost:3000/api/amend/<slug>/comment -H 'Content-Type: application/json' \
  -d '{"body":"stale","anchor_start":0,"anchor_end":3,"anchor_text":"ver","revision_id":"<old-revision-id>"}'
# → expect 409 {"code":"revision_not_latest"}
```

Also confirm in the DB that the step-2 comment still exists (comments are no longer deleted on resubmit).

- [ ] **Step 11: Commit**

```bash
git add src/lib/db.ts src/app/api src/app/docs/page.tsx
git commit -m "feat: create revisions on upload/resubmit, keep comments per revision"
```

---

### Task 4: Revision navigation helpers (TDD)

**Files:**
- Create: `src/lib/revisionNav.ts`
- Test: `src/lib/revisionNav.test.ts`

**Interfaces:**
- Produces (Task 5/7 consume):
  - `nextRevisionIndex(current: number, count: number, direction: 'prev' | 'next'): number | null` — null when out of bounds
  - `isTextEntryTarget(target: EventTarget | null): boolean` — true when arrow keys belong to text editing

- [ ] **Step 1: Write the failing tests**

Create `src/lib/revisionNav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextRevisionIndex, isTextEntryTarget } from './revisionNav'

describe('nextRevisionIndex', () => {
  it('steps backward and forward within bounds', () => {
    expect(nextRevisionIndex(1, 3, 'prev')).toBe(0)
    expect(nextRevisionIndex(1, 3, 'next')).toBe(2)
  })

  it('returns null at the edges', () => {
    expect(nextRevisionIndex(0, 3, 'prev')).toBeNull()
    expect(nextRevisionIndex(2, 3, 'next')).toBeNull()
  })

  it('returns null for a single-revision review', () => {
    expect(nextRevisionIndex(0, 1, 'prev')).toBeNull()
    expect(nextRevisionIndex(0, 1, 'next')).toBeNull()
  })
})

describe('isTextEntryTarget', () => {
  it('is true for inputs and textareas', () => {
    expect(isTextEntryTarget(document.createElement('input'))).toBe(true)
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true)
  })

  it('is true inside a contenteditable region (the Tiptap editor)', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    const child = document.createElement('p')
    editor.appendChild(child)
    document.body.appendChild(editor)
    expect(isTextEntryTarget(child)).toBe(true)
    document.body.removeChild(editor)
  })

  it('is false for plain elements and null', () => {
    expect(isTextEntryTarget(document.createElement('div'))).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- revisionNav`
Expected: FAIL — cannot resolve `./revisionNav`.

- [ ] **Step 3: Implement**

Create `src/lib/revisionNav.ts`:

```ts
// Pure helpers for revision navigation, extracted for unit testing.

export function nextRevisionIndex(
  current: number,
  count: number,
  direction: 'prev' | 'next'
): number | null {
  const target = direction === 'prev' ? current - 1 : current + 1
  if (target < 0 || target > count - 1) return null
  return target
}

// Arrow keys must not switch revisions while the user is moving a text cursor.
// Checks the [contenteditable] attribute via closest() rather than
// isContentEditable, which jsdom doesn't implement.
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  return target.closest('[contenteditable="true"]') !== null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/revisionNav.ts src/lib/revisionNav.test.ts
git commit -m "feat: add revision navigation helpers"
```

---

### Task 5: Revision state + header navigation

**Files:**
- Modify: `src/app/[slug]/page.tsx`
- Modify: `src/components/ReviewShell.tsx`
- Modify: `src/components/DecisionHeader.tsx`

**Interfaces:**
- Consumes: `getRevisionsByReviewId` (Task 3), `nextRevisionIndex` (Task 4), `Revision` type (Task 1).
- Produces:
  - `ReviewShell` props become `{ review: Review; revisions: Revision[]; initialComments: Comment[] }` (revisions ordered ascending, always ≥ 1 element).
  - `ReviewShell` internal: `goToRevision(target: number)` — Task 7's keyboard handler and Task 8's animation hook into this exact function.
  - `DecisionHeader` gains props: `revisionNumber: number`, `revisionCount: number`, `revisionCreatedAt: string`, `viewingLatest: boolean`, `onNavigateRevision: (direction: 'prev' | 'next') => void`, `onBackToLatest: () => void`.

- [ ] **Step 1: Load revisions in the page**

`src/app/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getReviewBySlug, getCommentsByReviewId, getRevisionsByReviewId } from '@/lib/db'
import ReviewShell from '@/components/ReviewShell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const review = await getReviewBySlug(slug)
  if (!review) notFound()

  const [revisions, comments] = await Promise.all([
    getRevisionsByReviewId(review.id),
    getCommentsByReviewId(review.id),
  ])

  return <ReviewShell review={review} revisions={revisions} initialComments={comments} />
}
```

- [ ] **Step 2: Revision state in ReviewShell**

In `src/components/ReviewShell.tsx`:

Props and imports:

```ts
import type { Review, Revision, Comment } from '@/types'
import { nextRevisionIndex } from '@/lib/revisionNav'

interface Props {
  review: Review
  revisions: Revision[]
  initialComments: Comment[]
}

export default function ReviewShell({ review, revisions, initialComments }: Props) {
```

Add revision state after the existing state declarations:

```ts
  const [revisionIndex, setRevisionIndex] = useState(revisions.length - 1)

  const currentRevision = revisions[revisionIndex]
  const viewingLatest = revisionIndex === revisions.length - 1
```

Add the navigation function (Task 8 adds animation inside it — keep it a named function):

```ts
  function goToRevision(target: number) {
    if (target < 0 || target >= revisions.length || target === revisionIndex) return
    setRevisionIndex(target)
    setActiveCommentId(null)
  }
```

Filter what the current revision sees. Replace the existing `rootComments`/`threads` memos with revision-scoped versions:

```ts
  const revisionComments = useMemo(
    () => comments.filter((c) => c.revision_id === currentRevision.id),
    [comments, currentRevision.id]
  )
  const rootComments = useMemo(() => revisionComments.filter((c) => c.parent_id === null), [revisionComments])
  const threads = useMemo(() => buildCommentThreads(revisionComments), [revisionComments])
```

Displayed content: the latest revision keeps the live edit buffer; older revisions show their snapshot:

```ts
  const displayedContent = viewingLatest ? editedContent : currentRevision.content
  const words = wordCount(displayedContent)
```

- [ ] **Step 3: Key the editor by revision**

`useEditor` in `ContentEditor` only reads `content` on mount, so switching revisions requires a remount. In ReviewShell's JSX, key the editor by revision and feed it the displayed content:

```tsx
        <ContentEditor
          key={currentRevision.id}
          content={displayedContent}
          editable={review.access === 'comment_and_edit' && !decided && viewingLatest}
          comments={rootComments}
          activeCommentId={activeCommentId}
          onChange={handleContentChange}
          onAddComment={handleAddComment}
          onEditorUpdate={() => setEditorVersion(v => v + 1)}
          onActiveCommentChange={setActiveCommentId}
          reviewSlug={review.slug}
        />
```

One subtlety: `handleContentChange` sets the shared `editedContent`, but an old revision's editor also fires `onChange` once on mount (markdown normalization). Guard it so old revisions never touch the edit buffer, and reset the baseline when the latest editor remounts:

```ts
  function handleContentChange(markdown: string) {
    if (!viewingLatest) return
    if (baselineContentRef.current === null) baselineContentRef.current = markdown
    setEditedContent(markdown)
  }
```

- [ ] **Step 4: DecisionHeader navigation control**

In `src/components/DecisionHeader.tsx`, extend the props:

```ts
interface Props {
  review: Review
  revisionNumber: number
  revisionCount: number
  revisionCreatedAt: string
  viewingLatest: boolean
  onNavigateRevision: (direction: 'prev' | 'next') => void
  onBackToLatest: () => void
  onApprove: () => void
  onRequestChanges: () => void
  onOpenContext: () => void
  wordCount: number
}
```

Timestamps now describe the *viewed revision*:

```ts
  const timeAgo = formatDistanceToNow(new Date(revisionCreatedAt), { addSuffix: true })
  const fullDate = format(new Date(revisionCreatedAt), 'MMM d, yyyy, h:mm a')
```

In the top card, the right side has three states — pending (buttons), decided ("Feedback sent to agent"), and viewing an old revision (which wins over both):

```tsx
        {!viewingLatest ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] text-[#6b7280] font-ui">
              Viewing revision {revisionNumber} of {revisionCount}
            </span>
            <Button variant="secondary" size="md" onClick={onBackToLatest}>
              Back to latest
            </Button>
          </div>
        ) : isPending ? (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="md" onClick={onRequestChanges}>
              Request Changes
            </Button>
            <Button variant="primary" size="md" onClick={onApprove}>
              Approve
            </Button>
          </div>
        ) : (
          <span className="text-[13px] text-[#6b7280] font-ui shrink-0">
            Feedback sent to agent
          </span>
        )}
```

In the metadata row's left cluster, add the arrow control before the `agent_model` span, rendered only when there are multiple revisions:

```tsx
          {revisionCount > 1 && (
            <>
              <span className="inline-flex items-center gap-1">
                <button
                  aria-label="Previous revision"
                  className="px-1 cursor-pointer text-[#6b7280] hover:text-[#000000] disabled:opacity-30 disabled:cursor-default"
                  disabled={revisionNumber === 1}
                  onClick={() => onNavigateRevision('prev')}
                >
                  ‹
                </button>
                <span>Rev {revisionNumber} of {revisionCount}</span>
                <button
                  aria-label="Next revision"
                  className="px-1 cursor-pointer text-[#6b7280] hover:text-[#000000] disabled:opacity-30 disabled:cursor-default"
                  disabled={revisionNumber === revisionCount}
                  onClick={() => onNavigateRevision('next')}
                >
                  ›
                </button>
              </span>
              <span className="text-[#9ca3af]">•</span>
            </>
          )}
```

- [ ] **Step 5: Wire the header from ReviewShell**

```tsx
        <DecisionHeader
          review={{ ...review, status: currentStatus }}
          revisionNumber={currentRevision.revision_number}
          revisionCount={revisions.length}
          revisionCreatedAt={currentRevision.created_at}
          viewingLatest={viewingLatest}
          onNavigateRevision={(direction) => {
            const target = nextRevisionIndex(revisionIndex, revisions.length, direction)
            if (target !== null) goToRevision(target)
          }}
          onBackToLatest={() => goToRevision(revisions.length - 1)}
          onApprove={() => setShowApprove(true)}
          onRequestChanges={() => setShowRequestChanges(true)}
          onOpenContext={() => setShowAgentContext(true)}
          wordCount={words}
        />
```

- [ ] **Step 6: Typecheck, test, verify in the browser**

Run: `npx tsc --noEmit && npm run test` — expected PASS.

Then `npm run dev` and, using the review created in Task 3 Step 10 (it has 2 revisions), open its amend URL and verify:
- Latest revision (2) shows by default; header shows `‹ Rev 2 of 2 ›` with the right arrow disabled.
- Clicking `‹` shows revision 1's content and its comment from round one; header card shows "Viewing revision 1 of 2" with a "Back to latest" button; the buttons/decided-label are hidden.
- "Submitted … ago" changes with the viewed revision.
- Single-revision reviews (e.g. `/dev-sample-review`) show no arrow control.

- [ ] **Step 7: Commit**

```bash
git add src/app/[slug]/page.tsx src/components/ReviewShell.tsx src/components/DecisionHeader.tsx
git commit -m "feat: browse review revisions from the header"
```

---

### Task 6: Read-only enforcement for old revisions

**Files:**
- Modify: `src/components/ContentEditor.tsx`
- Modify: `src/components/MarginalComments.tsx`
- Modify: `src/components/ReviewShell.tsx`

**Interfaces:**
- Consumes: `viewingLatest` / `currentRevision` from Task 5.
- Produces:
  - `ContentEditor` gains `revisionId: string` (sent as `revision_id` in the comment POST) and `commentingEnabled: boolean` (hides the floating toolbar).
  - `MarginalComments` gains `readOnly: boolean` (hides Reply/Edit/Delete hover actions and the reply composer). The existing `decided` prop keeps gating the reply composer as today.

- [ ] **Step 1: ContentEditor — commenting props**

In `src/components/ContentEditor.tsx`:

Add to `Props` and destructuring:

```ts
  revisionId: string
  commentingEnabled: boolean
```

Include the revision in the comment POST body in `submitComment` (this is what the Task 3 server guard checks):

```ts
      body: JSON.stringify({
        body,
        anchor_start: pendingComment.anchorStart,
        anchor_end: pendingComment.anchorEnd,
        anchor_text: pendingComment.anchorText,
        author_name: authorName || null,
        revision_id: revisionId,
      }),
```

Gate the toolbar (old revisions get no comment affordance at all):

```tsx
      {commentingEnabled && (
        <FloatingToolbar
          editor={editor}
          editable={editable}
          onCommentClick={handleCommentClick}
        />
      )}
```

- [ ] **Step 2: MarginalComments — readOnly mode**

In `src/components/MarginalComments.tsx`:

- Add `readOnly: boolean` to the top-level `Props` and to the main component's destructuring.
- Thread it down: the ThreadCard component (the one declaring `decided: boolean` around line 285) gains `readOnly: boolean`; pass `readOnly={readOnly}` where ReviewShell's `decided={decided}` is currently forwarded (around line 405).
- In `CommentRow`, add `readOnly: boolean` to its props and wrap the hover-actions block (the `div` with the Reply/Edit/Delete buttons, currently `className="col-start-1 row-start-1 flex items-center gap-2 opacity-0 ..."`) so it only renders when `!readOnly`:

```tsx
              {!readOnly && (
                <div className="col-start-1 row-start-1 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                  {/* ...existing Reply / Edit / Delete buttons unchanged... */}
                </div>
              )}
```

  Note: when `readOnly`, the avatar+name span should stop swapping away on hover — change its class to drop the `group-hover:` classes conditionally:

```tsx
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${readOnly ? '' : 'opacity-100 group-hover:opacity-0 group-hover:pointer-events-none transition-opacity'}`}>
```

- Pass `readOnly` into every `CommentRow` rendered by ThreadCard (root and replies).
- Gate the reply composer on both flags: `{!decided && !readOnly && replyingTo && (<ReplyComposer ... />)}`.

- [ ] **Step 3: Wire from ReviewShell**

```tsx
        <ContentEditor
          key={currentRevision.id}
          ...
          revisionId={currentRevision.id}
          commentingEnabled={viewingLatest}
          ...
        />
        ...
        <MarginalComments
          ...
          decided={decided}
          readOnly={!viewingLatest}
          ...
        />
```

Also gate the "Copy summary for agent" block on the latest revision (`{decided && viewingLatest && (...)}`), so an old revision's view isn't offering a summary that describes a different revision.

- [ ] **Step 4: Typecheck, test, verify in the browser**

Run: `npx tsc --noEmit && npm run test` — expected PASS.

In the browser, on the 2-revision review:
- On revision 1: selecting text shows no toolbar/comment button; hovering a comment shows no Reply/Edit/Delete; content is not editable.
- Back on revision 2 (latest): commenting, replying, editing all work exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContentEditor.tsx src/components/MarginalComments.tsx src/components/ReviewShell.tsx
git commit -m "feat: make old revisions strictly read-only"
```

---

### Task 7: Keyboard navigation

**Files:**
- Modify: `src/components/ReviewShell.tsx`

**Interfaces:**
- Consumes: `goToRevision`, `revisionIndex`, modal state flags (Task 5); `nextRevisionIndex`, `isTextEntryTarget` (Task 4).

- [ ] **Step 1: Add the keydown listener**

In `src/components/ReviewShell.tsx`, import `isTextEntryTarget` alongside `nextRevisionIndex`, then add:

```ts
  // Arrow-key revision navigation. Suppressed while typing (editor, inputs,
  // comment composers) or while any modal/drawer is open, where arrows mean
  // something else.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (showApprove || showRequestChanges || showAgentContext) return
      if (isTextEntryTarget(e.target)) return
      const direction = e.key === 'ArrowLeft' ? 'prev' : 'next'
      const target = nextRevisionIndex(revisionIndex, revisions.length, direction)
      if (target === null) return
      e.preventDefault()
      goToRevision(target)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })
```

Note: the effect intentionally has **no dependency array** — it re-subscribes every render so `handleKeyDown` always closes over current state. The listener is cheap; this matches how the codebase favors simplicity (see the beforeunload effect). Do NOT add `[]`, which would freeze `revisionIndex` at its initial value.

- [ ] **Step 2: Verify in the browser**

On the 2-revision review:
- Left/right arrows switch revisions; left on revision 1 and right on the latest do nothing.
- Click into the editor (latest revision) — arrows move the text cursor, not the revision.
- Open a reply composer or the Request Changes modal — arrows don't switch revisions.
- On an old revision (editor not editable), arrows still work even after clicking on the content.

- [ ] **Step 3: Run tests and commit**

Run: `npx tsc --noEmit && npm run test` — expected PASS.

```bash
git add src/components/ReviewShell.tsx
git commit -m "feat: keyboard arrow navigation between revisions"
```

---

### Task 8: Transition animation

**Files:**
- Modify: `src/app/globals.css` (if this file doesn't exist, find the global stylesheet imported by `src/app/layout.tsx` and use that)
- Modify: `src/components/ReviewShell.tsx`

**Interfaces:**
- Consumes: `goToRevision` from Task 5 (rewritten here to sequence the animation).

- [ ] **Step 1: Add the animation keyframes**

Append to the global stylesheet:

```css
/* Revision switching: content exits toward one side, the next revision
   enters from the other. Direction classes are set by ReviewShell. */
@keyframes rev-exit-left {
  to { opacity: 0; transform: translateX(-24px); }
}
@keyframes rev-exit-right {
  to { opacity: 0; transform: translateX(24px); }
}
@keyframes rev-enter-from-right {
  from { opacity: 0; transform: translateX(24px); }
}
@keyframes rev-enter-from-left {
  from { opacity: 0; transform: translateX(-24px); }
}
.rev-exit-left { animation: rev-exit-left 200ms ease-in forwards; }
.rev-exit-right { animation: rev-exit-right 200ms ease-in forwards; }
.rev-enter-from-right { animation: rev-enter-from-right 200ms ease-out; }
.rev-enter-from-left { animation: rev-enter-from-left 200ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .rev-exit-left, .rev-exit-right, .rev-enter-from-right, .rev-enter-from-left {
    animation-duration: 1ms;
  }
}
```

- [ ] **Step 2: Sequence the transition in ReviewShell**

Add animation state and rewrite `goToRevision` (from Task 5) to exit → swap → enter:

```ts
  const [revisionAnim, setRevisionAnim] = useState<string>('')
  const animTimerRef = useRef<number | null>(null)
  const ANIM_MS = 200

  function goToRevision(target: number) {
    if (target < 0 || target >= revisions.length || target === revisionIndex) return
    if (animTimerRef.current !== null) return // ignore input mid-transition
    const forward = target > revisionIndex
    setRevisionAnim(forward ? 'rev-exit-left' : 'rev-exit-right')
    animTimerRef.current = window.setTimeout(() => {
      setRevisionIndex(target)
      setActiveCommentId(null)
      setRevisionAnim(forward ? 'rev-enter-from-right' : 'rev-enter-from-left')
      animTimerRef.current = window.setTimeout(() => {
        setRevisionAnim('')
        animTimerRef.current = null
      }, ANIM_MS)
    }, ANIM_MS)
  }

  // Don't leave a mid-transition timer running after unmount.
  useEffect(() => () => {
    if (animTimerRef.current !== null) window.clearTimeout(animTimerRef.current)
  }, [])
```

Apply the class to the article container (the `w-[680px]` div holding the editor and comments):

```tsx
      <div className={`w-[680px] relative flex flex-col gap-6 py-10 ${revisionAnim}`} ref={editorContainerRef}>
```

- [ ] **Step 3: Verify in the browser**

On the 2-revision review:
- Arrow navigation (buttons and keyboard): content slides out toward the correct side and the other revision slides in from the opposite side, ~400ms total, no flash of unstyled/unswapped content.
- Marginal comments travel with the content.
- Rapid double-press of an arrow doesn't jump two revisions or stack animations.
- With "reduce motion" enabled in OS settings, switching is effectively instant.

- [ ] **Step 4: Run tests and commit**

Run: `npx tsc --noEmit && npm run test` — expected PASS.

```bash
git add src/app/globals.css src/components/ReviewShell.tsx
git commit -m "feat: animate revision switching"
```

---

### Task 9: Full-flow verification

**Files:** none (verification only)

- [ ] **Step 1: End-to-end round trip in the browser**

With `npm run dev` (dev DB):

1. Upload a review via curl (as in Task 3 Step 10), open its amend URL.
2. Add two anchored comments and one reply; Request Changes with general feedback.
3. Resubmit new content via curl; reload the page.
4. Verify: revision 2 shows by default and is pending with zero comments; `‹` navigates to revision 1 showing the old content with both comments and the reply, all read-only; arrows + keyboard + transition behave; "Back to latest" returns to revision 2.
5. Fetch the summary — it shows `**Revision:** 2`, no revision-1 comments.
6. Approve revision 2 in the UI; verify the summary flips to Approved and revision 1 is still browsable.

- [ ] **Step 2: Run the whole gate**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 3: Ship**

Reminder from Global Constraints: apply `0004_revisions.sql` to the **production** Supabase project before pushing (push to main auto-deploys via Vercel). Confirm with the user before pushing to main.
