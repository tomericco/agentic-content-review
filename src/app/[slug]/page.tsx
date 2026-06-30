import { notFound } from 'next/navigation'
import { getReviewBySlug, getCommentsByReviewId } from '@/lib/db'
import ReviewShell from '@/components/ReviewShell'

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const review = await getReviewBySlug(slug)
  if (!review) notFound()

  const comments = await getCommentsByReviewId(review.id)

  return <ReviewShell review={review} initialComments={comments} />
}
