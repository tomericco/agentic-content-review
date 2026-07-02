import { createClient } from '@supabase/supabase-js'
import type { Review, Comment } from '@/types'
import type { UploadInput, DecideInput } from './validate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CommentInput {
  body: string
  parent_id: string | null
  anchor_start: number | null
  anchor_end: number | null
  anchor_text: string | null
  author_name: string | null
}

export async function getExistingSlugs(): Promise<string[]> {
  const { data, error } = await supabase.from('reviews').select('slug')
  if (error) throw new Error(`DB error fetching slugs: ${error.message}`)
  return (data ?? []).map((r) => r.slug)
}

export async function createReview(input: UploadInput, slug: string): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      slug,
      title: input.title,
      content: input.content,
      content_type: input.content_type,
      context: input.context ?? null,
      access: input.access,
      agent_model: input.agent_model ?? null,
      author_email: input.author_email,
      reviewer_email: input.reviewer_email ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`DB error creating review: ${error.message}`)
  return data as Review
}

export async function getReviewBySlug(slug: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select()
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`DB error fetching review: ${error.message}`)
  return data as Review | null
}

export async function updateReviewDecision(
  id: string,
  input: DecideInput
): Promise<Review> {
  const update: Partial<Review> = {
    status: input.decision,
    decided_at: new Date().toISOString(),
  }
  if (input.decision === 'approved') {
    update.final_content = input.final_content ?? null
  }
  if (input.decision === 'changes_requested') {
    update.changes_requested = input.changes_requested ?? null
  }

  const { data, error } = await supabase
    .from('reviews')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`DB error updating review: ${error.message}`)
  return data as Review
}

export async function createComment(reviewId: string, input: CommentInput): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ review_id: reviewId, ...input })
    .select()
    .single()

  if (error) throw new Error(`DB error creating comment: ${error.message}`)
  return data as Comment
}

export async function getCommentById(id: string): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('comments')
    .select()
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`DB error fetching comment: ${error.message}`)
  return data as Comment | null
}

export async function updateComment(id: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ body })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`DB error updating comment: ${error.message}`)
  return data as Comment
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw new Error(`DB error deleting comment: ${error.message}`)
}

export async function getCommentsByReviewId(reviewId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select()
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`DB error fetching comments: ${error.message}`)
  return (data ?? []) as Comment[]
}

export async function resubmitReview(id: string, content: string): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      content,
      status: 'pending',
      final_content: null,
      changes_requested: null,
      decided_at: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`DB error resubmitting review: ${error.message}`)
  return data as Review
}
