import { NextRequest, NextResponse } from 'next/server'
import { getReviewBySlug, getCommentById, getLatestRevision, updateComment, deleteComment } from '@/lib/db'

type Params = { params: Promise<{ slug: string; commentId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, commentId } = await params
  try {
    const { body } = await req.json()
    if (!body?.trim()) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    }

    const review = await getReviewBySlug(slug)
    if (!review) {
      return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
    }

    const comment = await getCommentById(commentId)
    if (!comment || comment.review_id !== review.id) {
      return NextResponse.json({ error: 'Comment not found', code: 'comment_not_found' }, { status: 404 })
    }

    const latest = await getLatestRevision(review.id)
    if (!latest || comment.revision_id !== latest.id) {
      return NextResponse.json({ error: 'Comments on previous revisions are read-only', code: 'revision_not_latest' }, { status: 409 })
    }

    const updated = await updateComment(commentId, body)
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, commentId } = await params
  try {
    const review = await getReviewBySlug(slug)
    if (!review) {
      return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
    }

    const comment = await getCommentById(commentId)
    if (!comment || comment.review_id !== review.id) {
      return NextResponse.json({ error: 'Comment not found', code: 'comment_not_found' }, { status: 404 })
    }

    const latest = await getLatestRevision(review.id)
    if (!latest || comment.revision_id !== latest.id) {
      return NextResponse.json({ error: 'Comments on previous revisions are read-only', code: 'revision_not_latest' }, { status: 409 })
    }

    await deleteComment(commentId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
