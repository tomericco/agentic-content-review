import { describe, it, expect } from 'vitest'
import type { Comment } from '@/types'
import { buildCommentThreads, collectDescendantIds } from './commentTree'

function makeComment(overrides: Partial<Comment> & Pick<Comment, 'id' | 'created_at'>): Comment {
  return {
    review_id: 'review-1',
    parent_id: null,
    body: 'body',
    anchor_start: 0,
    anchor_end: 5,
    anchor_text: 'hello',
    author_name: null,
    ...overrides,
  }
}

describe('buildCommentThreads', () => {
  it('returns a single thread with no replies for a lone root comment', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const threads = buildCommentThreads([root])
    expect(threads).toEqual([{ root, replies: [] }])
  })

  it('groups a direct reply under its root', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const reply = makeComment({
      id: 'c2', created_at: '2026-01-01T00:01:00Z',
      parent_id: 'c1', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const threads = buildCommentThreads([root, reply])
    expect(threads).toEqual([{ root, replies: [reply] }])
  })

  it('a reply-to-a-reply lands in the same root thread as a flat entry, not nested', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const reply1 = makeComment({
      id: 'c2', created_at: '2026-01-01T00:01:00Z',
      parent_id: 'c1', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const reply2 = makeComment({
      id: 'c3', created_at: '2026-01-01T00:02:00Z',
      parent_id: 'c2', anchor_start: null, anchor_end: null, anchor_text: null, // replies to reply1, not root
    })
    const threads = buildCommentThreads([root, reply1, reply2])

    expect(threads).toHaveLength(1)
    expect(threads[0].root).toEqual(root)
    // Both replies appear in the same flat list, in chronological order — no nesting.
    expect(threads[0].replies).toEqual([reply1, reply2])
  })

  it('sorts replies within a thread by created_at ascending regardless of input order', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const later = makeComment({
      id: 'c2', created_at: '2026-01-01T00:05:00Z',
      parent_id: 'c1', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const earlier = makeComment({
      id: 'c3', created_at: '2026-01-01T00:02:00Z',
      parent_id: 'c1', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const threads = buildCommentThreads([root, later, earlier])
    expect(threads[0].replies).toEqual([earlier, later])
  })

  it('handles multiple independent roots', () => {
    const root1 = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const root2 = makeComment({ id: 'c2', created_at: '2026-01-01T00:01:00Z' })
    const reply = makeComment({
      id: 'c3', created_at: '2026-01-01T00:02:00Z',
      parent_id: 'c2', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const threads = buildCommentThreads([root1, root2, reply])
    expect(threads).toEqual([
      { root: root1, replies: [] },
      { root: root2, replies: [reply] },
    ])
  })

  it('sorts threads by root created_at ascending', () => {
    const laterRoot = makeComment({ id: 'c1', created_at: '2026-01-01T00:05:00Z' })
    const earlierRoot = makeComment({ id: 'c2', created_at: '2026-01-01T00:01:00Z' })
    const threads = buildCommentThreads([laterRoot, earlierRoot])
    expect(threads.map((t) => t.root.id)).toEqual(['c2', 'c1'])
  })

  it('treats a comment with an orphaned parent_id as its own root instead of dropping it', () => {
    const orphan = makeComment({
      id: 'c1', created_at: '2026-01-01T00:00:00Z',
      parent_id: 'does-not-exist', anchor_start: null, anchor_end: null, anchor_text: null,
    })
    const threads = buildCommentThreads([orphan])
    expect(threads).toEqual([{ root: orphan, replies: [] }])
  })

  it('returns an empty array for no comments', () => {
    expect(buildCommentThreads([])).toEqual([])
  })
})

describe('collectDescendantIds', () => {
  it('returns just the id for a comment with no replies', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    expect(collectDescendantIds([root], 'c1')).toEqual(['c1'])
  })

  it('includes direct replies', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const reply = makeComment({ id: 'c2', created_at: '2026-01-01T00:01:00Z', parent_id: 'c1' })
    expect(collectDescendantIds([root, reply], 'c1').sort()).toEqual(['c1', 'c2'])
  })

  it('includes a reply-to-a-reply (multi-level descendants)', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const reply1 = makeComment({ id: 'c2', created_at: '2026-01-01T00:01:00Z', parent_id: 'c1' })
    const reply2 = makeComment({ id: 'c3', created_at: '2026-01-01T00:02:00Z', parent_id: 'c2' })
    expect(collectDescendantIds([root, reply1, reply2], 'c1').sort()).toEqual(['c1', 'c2', 'c3'])
  })

  it('deleting a reply only collects its own descendants, not its siblings or ancestors', () => {
    const root = makeComment({ id: 'c1', created_at: '2026-01-01T00:00:00Z' })
    const reply1 = makeComment({ id: 'c2', created_at: '2026-01-01T00:01:00Z', parent_id: 'c1' })
    const reply2 = makeComment({ id: 'c3', created_at: '2026-01-01T00:02:00Z', parent_id: 'c1' })
    expect(collectDescendantIds([root, reply1, reply2], 'c2')).toEqual(['c2'])
  })
})
