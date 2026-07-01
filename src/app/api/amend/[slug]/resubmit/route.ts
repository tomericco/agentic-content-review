import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getReviewBySlug, resubmitReview } from '@/lib/db'
import { notifyReviewer } from '@/lib/email'

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

    notifyReviewer(updated).catch(() => {})

    revalidatePath(`/${slug}`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    return NextResponse.json({
      slug: updated.slug,
      review_url: `${baseUrl}/${updated.slug}`,
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
