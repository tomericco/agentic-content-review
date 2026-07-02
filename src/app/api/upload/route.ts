import { NextRequest, NextResponse } from 'next/server'
import { validateUpload } from '@/lib/validate'
import { generateSlug } from '@/lib/slug'
import { getExistingSlugs, createReview } from '@/lib/db'
// import { notifyReviewer } from '@/lib/email' // email sending disabled for now

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'invalid_json' }, { status: 400 })
  }

  const validation = validateUpload(body)
  if ('error' in validation) {
    const status = validation.code === 'content_too_large' ? 413 : 400
    return NextResponse.json(validation, { status })
  }

  try {
    const existingSlugs = await getExistingSlugs()
    const slug = generateSlug(validation.data.title, existingSlugs)

    const review = await createReview(validation.data, slug)
    // notifyReviewer(review).catch(() => {}) // email sending disabled for now
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    return NextResponse.json({
      review_id: review.id,
      slug: review.slug,
      amend_url: `${baseUrl}/${review.slug}`,
      summary_url: `${baseUrl}/api/amend/${review.slug}/summary`,
      resubmit_url: `${baseUrl}/api/amend/${review.slug}/resubmit`,
      status: review.status,
    }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    )
  }
}
