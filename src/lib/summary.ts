import type { Review, Comment } from '@/types'
import { buildCommentThreads } from './commentTree'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
}

function authorSuffix(comment: Comment): string {
  return comment.author_name ? ` — ${comment.author_name}` : ''
}

export function buildSummary(review: Review, comments: Comment[], resubmitUrl?: string): string {
  const lines: string[] = []

  lines.push(`# Amend Summary: ${review.title}`, '')
  lines.push(`**Status:** ${STATUS_LABELS[review.status] ?? review.status}`)

  if (review.decided_at) {
    lines.push(`**Decided at:** ${review.decided_at}`)
  }
  lines.push('')

  if (review.status === 'approved' && review.final_content) {
    lines.push('## Final Content', '', review.final_content, '')
  }

  if (comments.length > 0) {
    const threads = buildCommentThreads(comments)
    lines.push(`## Comments (${comments.length})`, '')
    threads.forEach((thread, i) => {
      lines.push(`${i + 1}. On: "${thread.root.anchor_text}"`)
      lines.push(`   → "${thread.root.body}"${authorSuffix(thread.root)}`)
      thread.replies.forEach((reply) => {
        lines.push(`     ↳ "${reply.body}"${authorSuffix(reply)}`)
      })
      lines.push('')
    })
  }

  if (review.status === 'changes_requested' && review.changes_requested) {
    lines.push('## General Feedback', '', review.changes_requested, '')
  }

  if (review.status === 'changes_requested' && resubmitUrl) {
    lines.push(
      '## Next Step',
      '',
      `Revise the content based on the feedback above, then PATCH your new version to:`,
      resubmitUrl,
      ''
    )
  }

  return lines.join('\n')
}
