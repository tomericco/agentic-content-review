import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { validateDecide } from '@/lib/validate'
import { getReviewBySlug, updateReviewDecision, getCommentsByReviewId } from '@/lib/db'
import { notifyAuthor } from '@/lib/email'

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug', code: 'missing_slug' }, { status: 400 })
  }

  const review = await getReviewBySlug(slug)
  if (!review) {
    return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
  }
  if (review.status !== 'pending') {
    return NextResponse.json({ error: 'Review already decided', code: 'review_already_decided' }, { status: 409 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'invalid_json' }, { status: 400 })
  }

  const validation = validateDecide(body)
  if ('error' in validation) {
    return NextResponse.json(validation, { status: 400 })
  }

  const { decision, changes_requested } = validation.data
  const comments = await getCommentsByReviewId(review.id)

  if (decision === 'changes_requested' && comments.length === 0 && !changes_requested) {
    return NextResponse.json(
      { error: 'Provide at least one comment or general feedback when requesting changes', code: 'changes_requested_requires_feedback' },
      { status: 400 }
    )
  }

  const updated = await updateReviewDecision(review.id, validation.data)

  notifyAuthor(updated, comments).catch(() => {})

  revalidatePath(`/${slug}`)

  return NextResponse.json({ status: updated.status })
}
