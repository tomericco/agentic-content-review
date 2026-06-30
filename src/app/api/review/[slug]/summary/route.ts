import { NextRequest, NextResponse } from 'next/server'
import { getReviewBySlug, getCommentsByReviewId } from '@/lib/db'
import { buildSummary } from '@/lib/summary'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const review = await getReviewBySlug(slug)
  if (!review) {
    return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
  }

  const comments = await getCommentsByReviewId(review.id)
  const summary = buildSummary(review, comments)

  return new NextResponse(summary, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
