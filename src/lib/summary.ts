import type { Review, Comment } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
}

export function buildSummary(review: Review, comments: Comment[]): string {
  const lines: string[] = []

  lines.push(`# Review Summary: ${review.title}`, '')
  lines.push(`**Status:** ${STATUS_LABELS[review.status] ?? review.status}`)

  if (review.decided_at) {
    lines.push(`**Decided at:** ${review.decided_at}`)
  }
  lines.push('')

  if (review.status === 'approved' && review.final_content) {
    lines.push('## Final Content', '', review.final_content, '')
  }

  if (comments.length > 0) {
    lines.push(`## Comments (${comments.length})`, '')
    comments.forEach((c, i) => {
      lines.push(`${i + 1}. On: "${c.anchor_text}"`)
      lines.push(`   → "${c.body}"`)
      lines.push('')
    })
  }

  if (review.status === 'changes_requested' && review.changes_requested) {
    lines.push('## General Feedback', '', review.changes_requested, '')
  }

  return lines.join('\n')
}
