import { Resend } from 'resend'
import type { Review, Comment } from '@/types'
import { buildSummary } from './summary'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `amend <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? ''

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function notifyReviewer(review: Review): Promise<void> {
  if (!review.reviewer_email || !process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM,
    to: review.reviewer_email,
    subject: `amend: ${review.title}`,
    html: `
      <p>An AI agent has submitted content for your review.</p>
      <p><strong>${esc(review.title)}</strong></p>
      ${review.context ? `<p><em>Context: ${esc(review.context)}</em></p>` : ''}
      <p><a href="${BASE_URL}/${review.slug}">Open in amend →</a></p>
      <p style="color:#6b7280;font-size:12px">No account needed — just click the link.</p>
    `,
  })
}

export async function notifyAuthor(review: Review, comments: Comment[]): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const summary = buildSummary(review, comments)
  const statusLabel = review.status === 'approved' ? 'Approved' : 'Changes Requested'

  await resend.emails.send({
    from: FROM,
    to: review.author_email,
    subject: `amend complete: ${review.title} — ${statusLabel}`,
    html: `
      <p>Your content has been reviewed.</p>
      <p><strong>${esc(review.title)}</strong> — ${statusLabel}</p>
      <p>Copy the summary below and paste it into your agent to continue:</p>
      <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:13px;white-space:pre-wrap">${esc(summary)}</pre>
      <p><a href="${BASE_URL}/${review.slug}">View in amend →</a></p>
    `,
  })
}
