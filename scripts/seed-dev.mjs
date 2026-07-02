// Ensures a constant, predictable sample review exists in the DEV database
// so you can test the review page locally without uploading anything first.
// Runs automatically before `npm run dev` (see the "predev" script).
//
// Safety: this refuses to run against the production Supabase project, no
// matter what .env file is loaded, as a hard guard against accidentally
// seeding (or worse, resetting) real data.

import { createClient } from '@supabase/supabase-js'

const PRODUCTION_PROJECT_REF = 'dvbugpltrlvgdcaiwyac'
const SAMPLE_SLUG = 'dev-sample-review'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isProductionUrl(url) {
  return typeof url === 'string' && url.includes(PRODUCTION_PROJECT_REF)
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project')) {
    console.warn('[seed-dev] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (or still a placeholder) — skipping dev seed.')
    return
  }

  if (isProductionUrl(supabaseUrl)) {
    console.error(`[seed-dev] Refusing to run: NEXT_PUBLIC_SUPABASE_URL points at the production project (${PRODUCTION_PROJECT_REF}). This script only seeds dev databases.`)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: existing, error: selectError } = await supabase
    .from('reviews')
    .select('slug')
    .eq('slug', SAMPLE_SLUG)
    .maybeSingle()

  if (selectError) {
    console.error('[seed-dev] Failed to check for existing sample review:', selectError.message)
    return
  }

  if (existing) {
    console.log(`[seed-dev] Sample review already exists at /${SAMPLE_SLUG} — leaving it as-is.`)
    return
  }

  const { error: insertError } = await supabase.from('reviews').insert({
    slug: SAMPLE_SLUG,
    title: 'Dev sample review',
    content:
      'This is a constant sample review, seeded automatically for local development. ' +
      'It talks about a new feature launch and includes a few sentences worth highlighting and discussing. ' +
      'Select any text here to add a comment, and use Reply on a comment to test threaded replies.',
    content_type: 'long_form',
    context: 'Seeded by scripts/seed-dev.mjs — safe to comment on, edit, or decide freely.',
    access: 'comment_and_edit',
    agent_model: null,
    author_email: 'dev-seed@example.com',
    reviewer_email: 'dev-seed@example.com',
    status: 'pending',
  })

  if (insertError) {
    console.error('[seed-dev] Failed to create sample review:', insertError.message)
    return
  }

  console.log(`[seed-dev] Created sample review at /${SAMPLE_SLUG}`)
}

main()
