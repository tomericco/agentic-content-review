import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getReviewBySlug, getCommentsByReviewId, getRevisionsByReviewId } from '@/lib/db'
import ReviewShell from '@/components/ReviewShell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const review = await getReviewBySlug(slug)
  if (!review) notFound()

  const [revisions, comments] = await Promise.all([
    getRevisionsByReviewId(review.id),
    getCommentsByReviewId(review.id),
  ])

  return <ReviewShell review={review} revisions={revisions} initialComments={comments} />
}
