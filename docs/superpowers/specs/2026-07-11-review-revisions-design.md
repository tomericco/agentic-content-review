# Review Revisions — Design

**Date:** 2026-07-11
**Status:** Approved

## Problem

Today each resubmit (`PATCH /api/amend/[slug]/resubmit`) overwrites `reviews.content` and deletes every comment (`deleteCommentsByReviewId`). Prior rounds of content and feedback are lost. We want every resubmit to create a new **revision**, with all previous revisions — content and their comments — preserved and viewable.

## Decisions made

- **Revisions are content + comments snapshots only.** Decision state (`status`, `changes_requested`, `final_content`, `decided_at`) stays on the `reviews` row exactly as today and is not versioned.
- **Old revisions are strictly read-only.** No new comments, edits, or decisions on anything but the latest revision.
- **The agent-facing summary stays scoped to the latest revision.** It gains a `**Revision:** N` line so agents can tell rounds apart.
- **Latest revision is shown by default** when a review loads.

## Data model

New table plus one column on `comments`:

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

alter table comments add column revision_id uuid references revisions(id) on delete cascade;
```

- `reviews.content` remains the canonical **latest** content. Existing reads (summary, decide, review page) keep working unchanged; `revisions` is the historical record and also contains a row for the latest revision.
- **Migration backfill:** insert one revision (number 1) per existing review from its current `content`; point all existing comments at that revision. After backfill, `comments.revision_id` is treated as required by application code (kept nullable in SQL to allow the two-step migration).

## API changes

- `POST /api/upload` — also inserts revision 1 for the new review.
- `PATCH /api/amend/[slug]/resubmit` — inserts revision N+1, updates `reviews.content`/status fields as today, and **no longer deletes comments**. Response gains a `revision` field (the new revision number).
- `POST /api/amend/[slug]/comment` — attaches new comments to the latest revision. Server-side guard: reject comment creation targeting a non-latest revision (backs the read-only UI).
- `GET /api/amend/[slug]/summary` — unchanged output, plus a `**Revision:** N` line in the header block.

## Data flow

`src/app/[slug]/page.tsx` fetches the review, **all** its revisions, and **all** comments in one load (documents are small). `ReviewShell` holds `currentRevisionIndex` state; switching revisions is pure client-side (no fetch), enabling the smooth transition. Comments are filtered per revision by `revision_id` on the client.

## UI & behavior

- **Header navigation:** `DecisionHeader` gains a compact `‹ Rev 2 of 3 ›` control in the metadata row (next to "Submitted X ago"). Rendered only when the review has more than one revision. Left = older, right = newer; arrows disable at the ends.
- **Keyboard:** global `ArrowLeft`/`ArrowRight` listeners switch revisions, ignored when focus is inside the editor, any input/textarea/contenteditable, or while a modal is open (otherwise arrows fight the text cursor).
- **Transition:** direction-aware slide-and-fade of the article area, ~250ms, CSS transform + opacity. Forward: old content exits left, new enters from right; backward mirrored.
- **Viewing an old revision:**
  - Editor forced read-only regardless of `access`.
  - Comments render without reply/edit/delete affordances.
  - Approve / Request Changes buttons are replaced with "Viewing revision N of M — Back to latest".
  - "Submitted X ago" reflects the viewed revision's `created_at`.
- **Default view:** latest revision.

## Error handling

- Resubmit revision insert and review update should not partially apply; if the revision insert fails, the review row is left untouched (insert revision first, then update the review).
- Comment creation against a stale revision returns 409 with a machine-readable code (`revision_not_latest`).

## Testing

Follows the existing vitest pattern (`src/lib/*.test.ts`):

- db helpers: creating revisions on upload/resubmit, fetching revisions ordered by number, comment-to-revision attachment.
- Guard logic: comment creation rejected for non-latest revision.
- `summary.test.ts` updated for the new revision line.
- UI keyboard-guard logic (focus in editor/input/modal suppresses navigation) unit-tested if extracted as a pure helper.
