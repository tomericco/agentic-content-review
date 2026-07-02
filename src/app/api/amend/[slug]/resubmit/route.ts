import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getReviewBySlug, resubmitReview, deleteCommentsByReviewId } from '@/lib/db'
import { SITE_URL } from '@/lib/site'
// import { notifyReviewer } from '@/lib/email' // email sending disabled for now

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  try {
    const review = await getReviewBySlug(slug)
    if (!review) {
      return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
    }
    if (review.status === 'pending') {
      return NextResponse.json({ error: 'Review is already pending', code: 'review_already_pending' }, { status: 409 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON', code: 'invalid_json' }, { status: 400 })
    }

    const { content } = body as { content?: string }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Missing required field: content', code: 'missing_field:content' }, { status: 400 })
    }

    const updated = await resubmitReview(review.id, content)

    // The new content invalidates every existing comment's anchor — clear
    // them so the reviewer starts the next round with a clean document.
    await deleteCommentsByReviewId(review.id)

    // notifyReviewer(updated).catch(() => {}) // email sending disabled for now

    revalidatePath(`/${slug}`)

    return NextResponse.json({
      slug: updated.slug,
      amend_url: `${SITE_URL}/${updated.slug}`,
      summary_url: `${SITE_URL}/api/amend/${updated.slug}/summary`,
      resubmit_url: `${SITE_URL}/api/amend/${updated.slug}/resubmit`,
      status: updated.status,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    )
  }
}
