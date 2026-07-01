import { NextRequest, NextResponse } from 'next/server'
import { updateComment, deleteComment } from '@/lib/db'

type Params = { params: Promise<{ slug: string; commentId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { commentId } = await params
  try {
    const { body } = await req.json()
    if (!body?.trim()) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    }
    const comment = await updateComment(commentId, body)
    return NextResponse.json(comment)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { commentId } = await params
  try {
    await deleteComment(commentId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
