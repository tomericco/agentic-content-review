import { describe, it, expect } from 'vitest'
import { buildSummary } from './summary'
import type { Review, Comment } from '@/types'

const baseReview: Review = {
  id: 'r1', slug: 'my-article', title: 'My Article',
  content: 'original', content_type: 'long_form', context: null,
  access: 'comment_and_edit', agent_model: null,
  author_email: 'author@example.com', reviewer_email: null,
  status: 'approved', final_content: 'final version',
  changes_requested: null, created_at: '2026-06-30T00:00:00Z',
  decided_at: '2026-06-30T01:00:00Z',
}

const comments: Comment[] = [
  { id: 'c1', review_id: 'r1', revision_id: 'rev-1', parent_id: null, body: 'Too wordy', anchor_text: 'final version',
    anchor_start: 0, anchor_end: 13, author_name: null, created_at: '2026-06-30T00:30:00Z' },
]

describe('buildSummary', () => {
  it('includes title, status, decided_at', () => {
    const s = buildSummary(baseReview, [])
    expect(s).toContain('# Amend Summary: My Article')
    expect(s).toContain('**Status:** Approved')
    expect(s).toContain('2026-06-30T01:00:00Z')
  })

  it('includes final content when approved', () => {
    const s = buildSummary(baseReview, [])
    expect(s).toContain('## Final Content')
    expect(s).toContain('final version')
  })

  it('includes comments with anchor text', () => {
    const s = buildSummary(baseReview, comments)
    expect(s).toContain('On: "final version"')
    expect(s).toContain('Too wordy')
  })

  it('shows author name when present, omits it when absent', () => {
    const named: Comment = { ...comments[0], id: 'c2', author_name: 'Quick Falcon' }
    const s = buildSummary(baseReview, [named])
    expect(s).toContain('"Too wordy" — Quick Falcon')

    const anonymous = buildSummary(baseReview, comments)
    expect(anonymous).toContain('"Too wordy"')
    expect(anonymous).not.toContain(' — ')
  })

  it('renders replies as a flat list under their root, including a reply-to-a-reply', () => {
    const root = comments[0]
    const reply1: Comment = {
      id: 'c2', review_id: 'r1', revision_id: 'rev-1', parent_id: 'c1', body: 'Agreed, will rewrite',
      anchor_start: null, anchor_end: null, anchor_text: null,
      author_name: 'Silent Otter', created_at: '2026-06-30T00:31:00Z',
    }
    const reply2: Comment = {
      id: 'c3', review_id: 'r1', revision_id: 'rev-1', parent_id: 'c2', body: 'Thanks!', // replies to reply1, not root
      anchor_start: null, anchor_end: null, anchor_text: null,
      author_name: 'Quick Falcon', created_at: '2026-06-30T00:32:00Z',
    }

    const s = buildSummary(baseReview, [root, reply1, reply2])

    expect(s).toContain('## Comments (3)')
    expect(s).toContain('1. On: "final version"')
    expect(s).toContain('   → "Too wordy"')
    expect(s).toContain('     ↳ "Agreed, will rewrite" — Silent Otter')
    // reply-to-a-reply still renders as a flat entry under the same root, not nested further
    expect(s).toContain('     ↳ "Thanks!" — Quick Falcon')
  })

  it('shows Changes Requested status and general feedback', () => {
    const review = { ...baseReview, status: 'changes_requested' as const,
      changes_requested: 'Fix the tone', final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Changes Requested')
    expect(s).toContain('## General Feedback')
    expect(s).toContain('Fix the tone')
  })

  it('includes a resubmit next-step when changes are requested and a resubmitUrl is given', () => {
    const review = { ...baseReview, status: 'changes_requested' as const,
      changes_requested: 'Fix the tone', final_content: null }
    const s = buildSummary(review, [], 'https://amend.to/api/amend/my-article/resubmit')
    expect(s).toContain('## Next Step')
    expect(s).toContain('https://amend.to/api/amend/my-article/resubmit')
  })

  it('omits the next-step section when no resubmitUrl is given', () => {
    const review = { ...baseReview, status: 'changes_requested' as const,
      changes_requested: 'Fix the tone', final_content: null }
    const s = buildSummary(review, [])
    expect(s).not.toContain('## Next Step')
  })

  it('omits the next-step section for statuses other than changes_requested', () => {
    const s = buildSummary(baseReview, [], 'https://amend.to/api/amend/my-article/resubmit')
    expect(s).not.toContain('## Next Step')
  })

  it('shows pending status', () => {
    const review = { ...baseReview, status: 'pending' as const, decided_at: null, final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Pending')
    expect(s).not.toContain('## Final Content')
  })
})
