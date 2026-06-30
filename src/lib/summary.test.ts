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
  { id: 'c1', review_id: 'r1', body: 'Too wordy', anchor_text: 'final version',
    anchor_start: 0, anchor_end: 13, created_at: '2026-06-30T00:30:00Z' },
]

describe('buildSummary', () => {
  it('includes title, status, decided_at', () => {
    const s = buildSummary(baseReview, [])
    expect(s).toContain('# Review Summary: My Article')
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

  it('shows Changes Requested status and general feedback', () => {
    const review = { ...baseReview, status: 'changes_requested' as const,
      changes_requested: 'Fix the tone', final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Changes Requested')
    expect(s).toContain('## General Feedback')
    expect(s).toContain('Fix the tone')
  })

  it('shows pending status', () => {
    const review = { ...baseReview, status: 'pending' as const, decided_at: null, final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Pending')
    expect(s).not.toContain('## Final Content')
  })
})
