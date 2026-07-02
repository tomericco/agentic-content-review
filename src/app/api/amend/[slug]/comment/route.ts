import { NextRequest, NextResponse } from 'next/server'
import { getReviewBySlug, getCommentById, createComment } from '@/lib/db'

const MAX_AUTHOR_NAME_LENGTH = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  try {
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
    if (!b.body) {
      return NextResponse.json({ error: 'Missing required comment fields', code: 'missing_comment_fields' }, { status: 400 })
    }

    let authorName: string | null = null
    if (b.author_name !== undefined && b.author_name !== null) {
      if (typeof b.author_name !== 'string') {
        return NextResponse.json({ error: 'author_name must be a string', code: 'invalid_author_name' }, { status: 400 })
      }
      const trimmed = b.author_name.trim()
      if (trimmed.length > MAX_AUTHOR_NAME_LENGTH) {
        return NextResponse.json({ error: `author_name exceeds ${MAX_AUTHOR_NAME_LENGTH} characters`, code: 'author_name_too_long' }, { status: 400 })
      }
      authorName = trimmed || null
    }

    const parentId = typeof b.parent_id === 'string' ? b.parent_id : null

    if (parentId) {
      const parent = await getCommentById(parentId)
      if (!parent) {
        return NextResponse.json({ error: 'Parent comment not found', code: 'parent_comment_not_found' }, { status: 404 })
      }
      if (parent.review_id !== review.id) {
        return NextResponse.json({ error: 'Parent comment belongs to a different review', code: 'parent_comment_wrong_review' }, { status: 400 })
      }

      const comment = await createComment(review.id, {
        body: b.body as string,
        parent_id: parentId,
        anchor_start: null,
        anchor_end: null,
        anchor_text: null,
        author_name: authorName,
      })

      return NextResponse.json(comment, { status: 201 })
    }

    if (!b.anchor_text || b.anchor_start === undefined || b.anchor_end === undefined) {
      return NextResponse.json({ error: 'Missing required comment fields', code: 'missing_comment_fields' }, { status: 400 })
    }

    const comment = await createComment(review.id, {
      body: b.body as string,
      parent_id: null,
      anchor_start: b.anchor_start as number,
      anchor_end: b.anchor_end as number,
      anchor_text: b.anchor_text as string,
      author_name: authorName,
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    )
  }
}
