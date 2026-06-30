import { NextRequest, NextResponse } from 'next/server'
import { getReviewBySlug, createComment } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
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

  const b = body as Record<string, unknown>
  if (!b.body || !b.anchor_text || b.anchor_start === undefined || b.anchor_end === undefined) {
    return NextResponse.json({ error: 'Missing required comment fields', code: 'missing_comment_fields' }, { status: 400 })
  }

  const comment = await createComment(review.id, {
    body: b.body as string,
    anchor_start: b.anchor_start as number,
    anchor_end: b.anchor_end as number,
    anchor_text: b.anchor_text as string,
  })

  return NextResponse.json(comment, { status: 201 })
}
