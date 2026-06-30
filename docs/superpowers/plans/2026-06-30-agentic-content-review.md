# Agentic Content Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP where AI agents upload content via HTTP API, a human reviewer edits and approves/requests changes via a magic link, and the agent operator receives the decision via email and a clipboard-ready summary.

**Architecture:** Next.js 15 App Router app deployed to Vercel, backed by Supabase Postgres. All business logic lives in `src/lib/`. API routes in `src/app/api/`. Agents integrate via raw HTTP — no MCP server in MVP. No auth in MVP.

**Tech Stack:** Next.js 15, TypeScript, Supabase (`@supabase/supabase-js`), Tiptap (WYSIWYG editor), Tailwind CSS, Vitest, Resend (`resend`) for email notifications

---

## Design Specification (from Figma)

All review page components follow this design system. Tasks 10–12 implement it exactly.

### Typography

Two font roles:

**UI font (all tool chrome — labels, buttons, metadata, badges, header, sidebar, modals):**
Charter or Iowan Old Style — system serif fonts, no install needed. Use the CSS stack:
```css
font-family: 'Iowan Old Style', 'Charter', 'Georgia', serif;
```
Define as a Tailwind utility class `font-ui` in `tailwind.config.ts`.

**Content font (reviewed article body only):**
Instrument Sans — loaded via `next/font/google`. Applied only to the content rendered inside `ContentEditor`.
```css
font-family: 'Instrument Sans', sans-serif;
```
Define as Tailwind utility class `font-content`.

**Sizes and weights (UI font):**
- Top-bar title: 16px, Regular
- Meta text (agent name, date, word count): 13px, Regular, `#6b7280`
- Status badge: 12px, SemiBold
- Section labels ("Reviewer Note"): 13px, Bold, `#000000`
- Buttons: 14px, Medium
- Placeholder text: 14px, Regular, `#9ca3af`, opacity 70%
- Comment body: 14px, Regular
- Modal text: 14px, Regular

**Sizes and weights (Content font — Instrument Sans):**
- Article h1: 24px, Medium (500), `#000000`, line-height 1.2
- Article h2: 18px, Medium (500), `#000000`, line-height 1.2
- Body paragraphs: 14px, Regular (400), `#000000`, line-height 1.5

### Colors
- **Page background:** `#f9fafb`
- **Card/panel background:** `#ffffff`
- **Border:** `#e5e7eb`
- **Primary text:** `#000000`
- **Secondary text:** `#6b7280`
- **Muted text / placeholder:** `#9ca3af`
- **Status badge — pending:** background `#fef3c7`, border `#fde68a`, text `#92400e`

### Layout
- **Page:** `#f9fafb` background, flex column, `gap-2` (`8px`), `pt-4` (`16px`), items centered
- **Content max-width:** 680px, centered
- **Top bar:** white, `rounded-xl` (12px), `shadow-[0px_6px_18px_-6px_rgba(0,0,0,0.05)]`, `border-b border-[#e5e7eb]`, height 56px, `px-6 py-4`
- **Top bar row:** flex, items-center, justify-between — title left, status badge right
- **Metadata row:** flex, justify-between — agent name + dot + date left, word count right — `px-3 py-2`
- **Content body:** `p-10` (40px), flex column, items center
- **Article content:** max-w-[680px], flex column, `gap-6` (24px)
- **Paragraphs:** `gap-6` (24px) between them
- **Editorial image:** full width, height 360px, `rounded-xl` (12px), `object-cover`
- **Reviewer Note textarea:** `bg-[#f9fafb]`, `border border-[#e5e7eb]`, height 100px, `p-3`, `rounded-lg` (8px)

### Status badge shape
```
rounded-full (99px), px-[10px] py-[4px], inline-flex items-center
```

### Dot separator (metadata row)
```
text-[#9ca3af] mx-2
```

---

## Global Constraints

- TypeScript strict mode everywhere
- All API responses use `{ error: string, code: string }` shape for errors
- `content_type` MVP only supports `"long_form"` — reject all others with `unsupported_content_type`
- `access` values: `"comment"` or `"comment_and_edit"` only
- Content size limit: 200KB
- Slug collision resolution: append a random word from the `SLUG_WORDS` list (defined in Task 2)
- No HTML content accepted — store and render markdown or plain text only
- Status enum: `"pending" | "approved" | "changes_requested"`

---

## File Map

```
/                               # Next.js app root
├── src/
│   ├── app/
│   │   ├── [slug]/
│   │   │   └── page.tsx        # Review page (server component shell)
│   │   └── api/
│   │       ├── upload/
│   │       │   └── route.ts    # POST /api/upload
│   │       ├── decide/
│   │       │   └── route.ts    # POST /api/decide
│   │       └── review/
│   │           └── [slug]/
│   │               ├── summary/
│   │               │   └── route.ts   # GET /api/review/[slug]/summary
│   │               ├── comment/
│   │               │   └── route.ts   # POST /api/review/[slug]/comment
│   │               └── resubmit/
│   │                   └── route.ts   # PATCH /api/review/[slug]/resubmit
│   ├── components/
│   │   ├── ReviewShell.tsx     # Client component: full review UI
│   │   ├── ContentEditor.tsx   # Markdown render + inline edit
│   │   ├── MarginalComments.tsx  # Margin comments, floated next to anchor text
│   │   ├── DecisionHeader.tsx  # Title, badges, Approve / Request Changes
│   │   └── RequestChangesModal.tsx
│   ├── lib/
│   │   ├── db.ts               # Supabase client + typed DB queries
│   │   ├── slug.ts             # Slug generation + collision handling
│   │   ├── validate.ts         # Upload + decide request validation
│   │   ├── summary.ts          # Build markdown summary string
│   │   └── email.ts            # Resend email notifications
│   └── types/
│       └── index.ts            # Shared TypeScript types
```

---

## Task 1: Project Scaffold + Supabase Schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/types/index.ts`
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.local.example`

**Interfaces:**
- Produces: `Review` and `Comment` TypeScript types used by all subsequent tasks

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd /Users/tomergabbai/agentic-content-review
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
```

Accept all defaults. `--src-dir` puts everything in `src/` from the start and sets the correct Tailwind content path and `@/*` alias in `tsconfig.json`. Then create the remaining empty directories:

```bash
mkdir -p src/lib src/types
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js resend
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline tiptap-markdown
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Define shared types**

Create `src/types/index.ts`:

```ts
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested'
export type ContentType = 'long_form'
export type AccessMode = 'comment' | 'comment_and_edit'

export interface Review {
  id: string
  slug: string
  title: string
  content: string
  content_type: ContentType
  context: string | null
  access: AccessMode
  agent_model: string | null
  author_email: string
  reviewer_email: string | null
  status: ReviewStatus
  final_content: string | null
  changes_requested: string | null
  created_at: string
  decided_at: string | null
}

export interface Comment {
  id: string
  review_id: string
  body: string
  anchor_start: number
  anchor_end: number
  anchor_text: string
  created_at: string
}
```

- [ ] **Step 5: Create Supabase migration**

Create `supabase/migrations/0001_init.sql`:

```sql
create extension if not exists "pgcrypto";

create table reviews (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  content          text not null,
  content_type     text not null default 'long_form',
  context          text,
  access           text not null,
  agent_model      text,
  author_email     text not null,
  reviewer_email   text,
  status           text not null default 'pending',
  final_content    text,
  changes_requested text,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

create table comments (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references reviews(id) on delete cascade,
  body         text not null,
  anchor_start integer not null,
  anchor_end   integer not null,
  anchor_text  text not null,
  created_at   timestamptz not null default now()
);

create index comments_review_id_idx on comments(review_id);
```

- [ ] **Step 6: Create Supabase project and run migration**

1. Go to supabase.com, create a new project
2. In SQL Editor, paste and run `supabase/migrations/0001_init.sql`
3. Copy the project URL and anon key from Settings → API

- [ ] **Step 7: Configure environment**

Create `.env.local.example`:
```
# Supabase — from supabase.com → project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App base URL — used in email links
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Resend — from resend.com → API Keys
RESEND_API_KEY=re_...
# Must be a verified sender domain in Resend (resend.com → Domains)
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` before running the app. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` can be left blank during Tasks 1–12; they are only required for Task 13 (email notifications).

- [ ] **Step 8: Verify app boots**

```bash
npm run dev
```

Expected: Next.js dev server running at http://localhost:3000 with no errors.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js app with Supabase schema and shared types"
```

---

## Task 2: Slug Generation

**Files:**
- Create: `src/lib/slug.ts`
- Create: `src/lib/slug.test.ts`

**Interfaces:**
- Produces: `generateSlug(title: string, existingSlugs: string[]): string`

- [ ] **Step 1: Write failing tests**

Create `src/lib/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateSlug, slugify } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('June Newsletter Intro')).toBe('june-newsletter-intro')
  })

  it('strips special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('collapses multiple spaces', () => {
    expect(slugify('a  b   c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })
})

describe('generateSlug', () => {
  it('returns slugified title when no collision', () => {
    expect(generateSlug('June Newsletter', [])).toBe('june-newsletter')
  })

  it('appends a word on collision', () => {
    const slug = generateSlug('June Newsletter', ['june-newsletter'])
    expect(slug).toMatch(/^june-newsletter-[a-z]+$/)
    expect(slug).not.toBe('june-newsletter')
  })

  it('keeps appending words until unique', () => {
    // Simulate all one-word suffixes taken (won't happen in practice, but verifies loop)
    const slug = generateSlug('test', ['test'])
    expect(slug).not.toBe('test')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- slug
```

Expected: FAIL — `generateSlug` and `slugify` not defined.

- [ ] **Step 3: Implement**

Create `src/lib/slug.ts`:

```ts
const SLUG_WORDS = [
  'amber', 'falcon', 'cedar', 'nova', 'echo', 'grove', 'ember', 'ridge',
  'atlas', 'breeze', 'cove', 'dune', 'flint', 'haven', 'inlet', 'jade',
  'kite', 'lark', 'marsh', 'nimbus', 'orbit', 'pine', 'quill', 'reef',
  'stone', 'tide', 'vale', 'wren', 'zenith', 'blaze',
]

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateSlug(title: string, existingSlugs: string[]): string {
  const base = slugify(title)
  if (!existingSlugs.includes(base)) return base

  const taken = new Set(existingSlugs)
  for (const word of SLUG_WORDS) {
    const candidate = `${base}-${word}`
    if (!taken.has(candidate)) return candidate
  }

  // Extremely unlikely fallback: all words taken, append timestamp fragment
  return `${base}-${Date.now().toString(36)}`
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- slug
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: slug generation with readable collision handling"
```

---

## Task 3: Request Validation

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/lib/validate.test.ts`

**Interfaces:**
- Produces:
  - `validateUpload(body: unknown): { data: UploadInput } | { error: string, code: string }`
  - `validateDecide(body: unknown): { data: DecideInput } | { error: string, code: string }`
  - `UploadInput` and `DecideInput` types

- [ ] **Step 1: Write failing tests**

Create `src/lib/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateUpload, validateDecide } from './validate'

const validUpload = {
  title: 'My Article',
  content: 'Hello world',
  content_type: 'long_form',
  access: 'comment_and_edit',
  author_email: 'author@example.com',
}

describe('validateUpload', () => {
  it('accepts valid input', () => {
    const result = validateUpload(validUpload)
    expect('data' in result).toBe(true)
  })

  it('rejects missing title', () => {
    const result = validateUpload({ ...validUpload, title: undefined })
    expect('error' in result && result.code).toBe('missing_field:title')
  })

  it('rejects missing content', () => {
    const result = validateUpload({ ...validUpload, content: undefined })
    expect('error' in result && result.code).toBe('missing_field:content')
  })

  it('rejects missing content_type', () => {
    const result = validateUpload({ ...validUpload, content_type: undefined })
    expect('error' in result && result.code).toBe('missing_field:content_type')
  })

  it('rejects unsupported content_type', () => {
    const result = validateUpload({ ...validUpload, content_type: 'social' })
    expect('error' in result && result.code).toBe('unsupported_content_type')
  })

  it('rejects invalid access value', () => {
    const result = validateUpload({ ...validUpload, access: 'view_only' })
    expect('error' in result && result.code).toBe('invalid_access_mode')
  })

  it('rejects content over 200KB', () => {
    const result = validateUpload({ ...validUpload, content: 'x'.repeat(200 * 1024 + 1) })
    expect('error' in result && result.code).toBe('content_too_large')
  })
})

describe('validateDecide', () => {
  it('accepts approve', () => {
    const result = validateDecide({ decision: 'approved', final_content: 'Final text' })
    expect('data' in result).toBe(true)
  })

  it('accepts changes_requested with general feedback', () => {
    const result = validateDecide({ decision: 'changes_requested', changes_requested: 'Fix tone' })
    expect('data' in result).toBe(true)
  })

  it('accepts changes_requested with no text (comments are the signal)', () => {
    const result = validateDecide({ decision: 'changes_requested' })
    expect('data' in result).toBe(true)
  })

  it('rejects unknown decision', () => {
    const result = validateDecide({ decision: 'rejected' })
    expect('error' in result && result.code).toBe('invalid_decision')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- validate
```

Expected: FAIL — `validateUpload` not defined.

- [ ] **Step 3: Implement**

Create `src/lib/validate.ts`:

```ts
import type { ContentType, AccessMode } from '@/types'

const SUPPORTED_CONTENT_TYPES: ContentType[] = ['long_form']
const VALID_ACCESS_MODES: AccessMode[] = ['comment', 'comment_and_edit']
const MAX_CONTENT_BYTES = 200 * 1024

export interface UploadInput {
  title: string
  content: string
  content_type: ContentType
  context?: string
  access: AccessMode
  agent_model?: string
  author_email: string
  reviewer_email?: string
}

export interface DecideInput {
  decision: 'approved' | 'changes_requested'
  final_content?: string
  changes_requested?: string
}

type ValidationResult<T> = { data: T } | { error: string; code: string }

function required(body: Record<string, unknown>, field: string): string | null {
  const val = body[field]
  if (val === undefined || val === null || val === '') return field
  return null
}

export function validateUpload(body: unknown): ValidationResult<UploadInput> {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object', code: 'invalid_body' }
  }
  const b = body as Record<string, unknown>

  for (const field of ['title', 'content', 'content_type', 'access', 'author_email']) {
    if (required(b, field)) {
      return { error: `Missing required field: ${field}`, code: `missing_field:${field}` }
    }
  }

  if (!SUPPORTED_CONTENT_TYPES.includes(b.content_type as ContentType)) {
    return { error: `Unsupported content_type: ${b.content_type}`, code: 'unsupported_content_type' }
  }

  if (!VALID_ACCESS_MODES.includes(b.access as AccessMode)) {
    return { error: `Invalid access value: ${b.access}`, code: 'invalid_access_mode' }
  }

  const contentBytes = new TextEncoder().encode(b.content as string).length
  if (contentBytes > MAX_CONTENT_BYTES) {
    return { error: 'Content exceeds 200KB limit', code: 'content_too_large' }
  }

  return {
    data: {
      title: b.title as string,
      content: b.content as string,
      content_type: b.content_type as ContentType,
      context: b.context as string | undefined,
      access: b.access as AccessMode,
      agent_model: b.agent_model as string | undefined,
      author_email: b.author_email as string,
      reviewer_email: b.reviewer_email as string | undefined,
    },
  }
}

export function validateDecide(body: unknown): ValidationResult<DecideInput> {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object', code: 'invalid_body' }
  }
  const b = body as Record<string, unknown>
  const decision = b.decision

  if (decision !== 'approved' && decision !== 'changes_requested') {
    return { error: `Invalid decision: ${decision}`, code: 'invalid_decision' }
  }

  return {
    data: {
      decision: decision as 'approved' | 'changes_requested',
      final_content: b.final_content as string | undefined,
      changes_requested: b.changes_requested as string | undefined,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- validate
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/validate.test.ts
git commit -m "feat: request validation for upload and decide endpoints"
```

---

## Task 4: Database Layer

**Files:**
- Create: `src/lib/db.ts`

**Interfaces:**
- Produces:
  - `createReview(input: UploadInput, slug: string): Promise<Review>`
  - `getReviewBySlug(slug: string): Promise<Review | null>`
  - `getExistingSlugs(): Promise<string[]>`
  - `updateReviewDecision(id: string, decision: DecideInput): Promise<Review>`
  - `createComment(reviewId: string, body: CommentInput): Promise<Comment>`
  - `getCommentsByReviewId(reviewId: string): Promise<Comment[]>`
  - `CommentInput` type

- [ ] **Step 1: Implement database layer**

Create `src/lib/db.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Review, Comment } from '@/types'
import type { UploadInput, DecideInput } from './validate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CommentInput {
  body: string
  anchor_start: number
  anchor_end: number
  anchor_text: string
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

export async function getCommentsByReviewId(reviewId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select()
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`DB error fetching comments: ${error.message}`)
  return (data ?? []) as Comment[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: Supabase database layer with typed queries"
```

---

## Task 5: ~~Webhook Delivery~~ (removed from MVP)

> Webhook delivery is not part of the MVP. Agents receive feedback via email notification and the "Copy summary for agent" clipboard button. Skip this task — proceed to Task 6.

---

## Task 6: Summary Generation

**Files:**
- Create: `src/lib/summary.ts`
- Create: `src/lib/summary.test.ts`

**Interfaces:**
- Consumes: `Review`, `Comment` from `@/types`
- Produces: `buildSummary(review: Review, comments: Comment[]): string`

- [ ] **Step 1: Write failing tests**

Create `src/lib/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSummary } from './summary'
import type { Review, Comment } from '@/types'

const baseReview: Review = {
  id: 'r1', slug: 'my-article', title: 'My Article',
  content: 'original', content_type: 'long_form', context: null,
  access: 'comment_and_edit', agent_model: null,
  author_email: 'author@example.com', reviewer_email: null,
  status: 'approved', final_content: 'final version',
  changes_requested: null, created_at: '2026-06-30T00:00:00Z',
  decided_at: '2026-06-30T01:00:00Z',
}

const comments: Comment[] = [
  { id: 'c1', review_id: 'r1', body: 'Too wordy', anchor_text: 'final version',
    anchor_start: 0, anchor_end: 13, created_at: '2026-06-30T00:30:00Z' },
]

describe('buildSummary', () => {
  it('includes title, status, decided_at', () => {
    const s = buildSummary(baseReview, [])
    expect(s).toContain('# Review Summary: My Article')
    expect(s).toContain('**Status:** Approved')
    expect(s).toContain('2026-06-30T01:00:00Z')
  })

  it('includes final content when approved', () => {
    const s = buildSummary(baseReview, [])
    expect(s).toContain('## Final Content')
    expect(s).toContain('final version')
  })

  it('includes comments with anchor text', () => {
    const s = buildSummary(baseReview, comments)
    expect(s).toContain('On: "final version"')
    expect(s).toContain('Too wordy')
  })

  it('shows Changes Requested status and general feedback', () => {
    const review = { ...baseReview, status: 'changes_requested' as const,
      changes_requested: 'Fix the tone', final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Changes Requested')
    expect(s).toContain('## General Feedback')
    expect(s).toContain('Fix the tone')
  })

  it('shows pending status', () => {
    const review = { ...baseReview, status: 'pending' as const, decided_at: null, final_content: null }
    const s = buildSummary(review, [])
    expect(s).toContain('**Status:** Pending')
    expect(s).not.toContain('## Final Content')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- summary
```

Expected: FAIL — `buildSummary` not defined.

- [ ] **Step 3: Implement**

Create `src/lib/summary.ts`:

```ts
import type { Review, Comment } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
}

export function buildSummary(review: Review, comments: Comment[]): string {
  const lines: string[] = []

  lines.push(`# Review Summary: ${review.title}`, '')
  lines.push(`**Status:** ${STATUS_LABELS[review.status] ?? review.status}`)

  if (review.decided_at) {
    lines.push(`**Decided at:** ${review.decided_at}`)
  }
  lines.push('')

  if (review.status === 'approved' && review.final_content) {
    lines.push('## Final Content', '', review.final_content, '')
  }

  if (comments.length > 0) {
    lines.push(`## Comments (${comments.length})`, '')
    comments.forEach((c, i) => {
      lines.push(`${i + 1}. On: "${c.anchor_text}"`)
      lines.push(`   → "${c.body}"`)
      lines.push('')
    })
  }

  if (review.status === 'changes_requested' && review.changes_requested) {
    lines.push('## General Feedback', '', review.changes_requested, '')
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- summary
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/summary.ts src/lib/summary.test.ts
git commit -m "feat: markdown summary builder for agent-readable review output"
```

---

## Task 7: POST /api/upload

**Files:**
- Create: `src/app/api/upload/route.ts`

**Interfaces:**
- Consumes: `validateUpload` from `@/lib/validate`, `generateSlug` from `@/lib/slug`, `getExistingSlugs`, `createReview` from `@/lib/db`
- Produces: `POST /api/upload` → `{ review_id, slug, review_url, status }`

- [ ] **Step 1: Implement route**

Create `src/app/api/upload/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { validateUpload } from '@/lib/validate'
import { generateSlug } from '@/lib/slug'
import { getExistingSlugs, createReview } from '@/lib/db'

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

  const existingSlugs = await getExistingSlugs()
  const slug = generateSlug(validation.data.title, existingSlugs)

  const review = await createReview(validation.data, slug)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  return NextResponse.json({
    review_id: review.id,
    slug: review.slug,
    review_url: `${baseUrl}/${review.slug}`,
    status: review.status,
  }, { status: 201 })
}
```

- [ ] **Step 2: Smoke test with curl**

Start the dev server: `npm run dev`

```bash
curl -s -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Review",
    "content": "# Hello\n\nThis is a test article.",
    "content_type": "long_form",
    "access": "comment_and_edit",
    "author_email": "author@example.com"
  }' | jq .
```

Expected output:
```json
{
  "review_id": "<uuid>",
  "slug": "my-first-review",
  "review_url": "http://localhost:3000/my-first-review",
  "status": "pending"
}
```

- [ ] **Step 3: Verify error cases**

```bash
# Missing field
curl -s -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"title": "test"}' | jq .
```

Expected: `{ "error": "Missing required field: content", "code": "missing_field:content" }` with status 400.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: POST /api/upload endpoint"
```

---

## Task 8: POST /api/decide, PATCH /api/review/[slug]/resubmit, GET /api/review/[slug]/summary

**Files:**
- Create: `src/app/api/decide/route.ts`
- Create: `src/app/api/review/[slug]/resubmit/route.ts`
- Create: `src/app/api/review/[slug]/summary/route.ts`
- Modify: `src/lib/db.ts` — add `resubmitReview`

**Interfaces:**
- Consumes: `validateDecide`, `getReviewBySlug`, `updateReviewDecision`, `resubmitReview`, `getCommentsByReviewId`, `buildSummary`
- Note: email calls (`notifyAuthor`, `notifyReviewer`) are NOT wired in Task 8 — they are added to these routes in Task 13 Step 4 once `src/lib/email.ts` exists
- Produces: `POST /api/decide` → `{ status }`, `PATCH /api/review/[slug]/resubmit` → `{ slug, review_url }`, `GET /api/review/[slug]/summary` → plain text markdown

**Resubmit behaviour:** resets the review to `pending`, replaces `content` with the revised version, clears `final_content` / `changes_requested` / `decided_at`. Existing comments are preserved as context for the next review round. (Email notification to reviewer is wired in Task 13 once `src/lib/email.ts` exists — do NOT add it here.)

- [ ] **Step 1: Implement decide route**

Create `src/app/api/decide/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { validateDecide } from '@/lib/validate'
import { getReviewBySlug, updateReviewDecision, getCommentsByReviewId } from '@/lib/db'

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug', code: 'missing_slug' }, { status: 400 })
  }

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

  const validation = validateDecide(body)
  if ('error' in validation) {
    return NextResponse.json(validation, { status: 400 })
  }

  const { decision, changes_requested } = validation.data
  const comments = await getCommentsByReviewId(review.id)

  if (decision === 'changes_requested' && comments.length === 0 && !changes_requested) {
    return NextResponse.json(
      { error: 'Provide at least one comment or general feedback when requesting changes', code: 'changes_requested_requires_feedback' },
      { status: 400 }
    )
  }

  const updated = await updateReviewDecision(review.id, validation.data)

  revalidatePath(`/${slug}`)

  return NextResponse.json({ status: updated.status })
}
```

- [ ] **Step 2: Add `resubmitReview` to db.ts**

Add to `src/lib/db.ts`:

```ts
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
```

- [ ] **Step 3: Implement resubmit route**

Create `src/app/api/review/[slug]/resubmit/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getReviewBySlug, resubmitReview } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
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

  revalidatePath(`/${slug}`)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  return NextResponse.json({
    slug: updated.slug,
    review_url: `${baseUrl}/${updated.slug}`,
    status: updated.status,
  })
}
```

- [ ] **Step 4: Implement summary route**

Create `src/app/api/review/[slug]/summary/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getReviewBySlug, getCommentsByReviewId } from '@/lib/db'
import { buildSummary } from '@/lib/summary'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const review = await getReviewBySlug(slug)
  if (!review) {
    return NextResponse.json({ error: 'Review not found', code: 'review_not_found' }, { status: 404 })
  }

  const comments = await getCommentsByReviewId(review.id)
  const summary = buildSummary(review, comments)

  return new NextResponse(summary, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 5: Smoke test**

```bash
# Approve
curl -s -X POST "http://localhost:3000/api/decide?slug=my-first-review" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "final_content": "# Hello\n\nApproved version."}' | jq .
# Expected: { "status": "approved" }

# Read summary
curl -s "http://localhost:3000/api/review/my-first-review/summary"
# Expected: markdown starting with "# Review Summary: My First Review"

# Resubmit revised content
curl -s -X PATCH "http://localhost:3000/api/review/my-first-review/resubmit" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Hello\n\nRevised version."}' | jq .
# Expected: { "slug": "my-first-review", "review_url": "...", "status": "pending" }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/decide/route.ts src/app/api/review/ src/lib/db.ts
git commit -m "feat: decide, resubmit, and summary routes"
```

---

## Task 9: POST /api/review/[slug]/comment

**Files:**
- Create: `src/app/api/review/[slug]/comment/route.ts`

**Interfaces:**
- Consumes: `getReviewBySlug`, `createComment` from `@/lib/db`
- Produces: `POST /api/review/[slug]/comment` → `Comment`

- [ ] **Step 1: Implement comment route**

Create `src/app/api/review/[slug]/comment/route.ts`:

```ts
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
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -X POST "http://localhost:3000/api/review/my-first-review/comment" \
  -H "Content-Type: application/json" \
  -d '{"body": "This is unclear", "anchor_text": "Hello", "anchor_start": 2, "anchor_end": 7}' | jq .
```

Expected: comment object with `id`, `review_id`, `body`, `anchor_text`, `created_at`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/
git commit -m "feat: POST /api/review/[slug]/comment endpoint"
```

---

## Task 10: Review Page — Server Shell + Context Panel + Header

**Files:**
- Create: `src/components/ContentEditor.tsx` (stub — full implementation in Task 11)
- Create: `src/components/MarginalComments.tsx` (stub — full implementation in Task 12)
- Create: `src/components/RequestChangesModal.tsx` (stub — full implementation in Task 12)
- Create: `src/components/DecisionHeader.tsx`
- Create: `src/components/ReviewShell.tsx`
- Create: `src/app/[slug]/page.tsx`
- Create: `src/app/[slug]/not-found.tsx`

**Interfaces:**
- Consumes: `getReviewBySlug`, `getCommentsByReviewId` from `@/lib/db`, `Review`, `Comment` from `@/types`
- Produces: `/[slug]` page rendering review UI

- [ ] **Step 1: Create stub components**

ReviewShell imports ContentEditor, MarginalComments, and RequestChangesModal. Create stubs so TypeScript compiles at each step — Tasks 11–12 replace them with full implementations.

Create `src/components/ContentEditor.tsx`:

```tsx
'use client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ContentEditor(_props: any) { return null }
```

Create `src/components/MarginalComments.tsx`:

```tsx
'use client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MarginalComments(_props: any) { return null }
```

Create `src/components/RequestChangesModal.tsx`:

```tsx
'use client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RequestChangesModal(_props: any) { return null }
```

- [ ] **Step 2: Implement DecisionHeader**

Top bar: white card, 680px centered, subtle shadow. Title on the left. When pending, action buttons on the right. When decided, the right side is empty — no status badge in the header.

Create `src/components/DecisionHeader.tsx`:

```tsx
'use client'

import type { Review } from '@/types'

interface Props {
  review: Review
  onApprove: () => void
  onRequestChanges: () => void
  wordCount: number
}

export default function DecisionHeader({ review, onApprove, onRequestChanges, wordCount }: Props) {
  const isPending = review.status === 'pending'

  const formattedDate = new Date(review.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-2 pt-4 items-center w-full bg-[#f9fafb]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#e5e7eb] rounded-xl shadow-[0px_6px_18px_-6px_rgba(0,0,0,0.05)] w-[680px] h-14 px-6 py-4 flex items-center justify-between shrink-0">
        <p className="text-[#000000] text-base font-normal font-ui truncate">
          {review.title}
        </p>
        {isPending ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onRequestChanges}
              className="px-4 py-1.5 text-sm font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-gray-50 transition-colors font-ui"
            >
              Request Changes
            </button>
            <button
              onClick={onApprove}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-[#000000] rounded-lg hover:bg-[#1f2937] transition-colors font-ui"
            >
              Approve
            </button>
          </div>
        ) : (
          <span className="text-[13px] text-[#6b7280] font-ui shrink-0">
            Feedback sent to agent
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="w-[680px] flex items-center justify-between px-3 py-2 text-[13px] text-[#6b7280] font-ui">
        <div className="flex items-center gap-2">
          {review.agent_model && <span>{review.agent_model}</span>}
          {review.agent_model && <span className="text-[#9ca3af]">•</span>}
          <span>{formattedDate}</span>
        </div>
        <span>{wordCount.toLocaleString()} words</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement ReviewShell (client wrapper)**

The shell renders the full Figma layout: `#f9fafb` page background, centered 680px column, header + metadata row + scrollable article body. The reviewer note textarea (from Figma) doubles as the general feedback field — its value is passed to RequestChangesModal on submit.

Create `src/components/ReviewShell.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { Review, Comment } from '@/types'
import DecisionHeader from './DecisionHeader'
import ContentEditor from './ContentEditor'
import MarginalComments from './MarginalComments'
import RequestChangesModal from './RequestChangesModal'

interface Props {
  review: Review
  initialComments: Comment[]
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function ReviewShell({ review, initialComments }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [editedContent, setEditedContent] = useState(review.content)
  const [reviewerNote, setReviewerNote] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [decided, setDecided] = useState(review.status !== 'pending')
  const [currentStatus, setCurrentStatus] = useState(review.status)

  // Warn on unsaved changes
  useEffect(() => {
    const hasChanges =
      !decided &&
      (editedContent !== review.content || comments.length > initialComments.length)
    if (!hasChanges) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [decided, editedContent, review.content, comments.length, initialComments.length])

  async function handleApprove() {
    await fetch(`/api/decide?slug=${review.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved', final_content: editedContent }),
    })
    setDecided(true)
    setCurrentStatus('approved')
  }

  async function handleAddComment(comment: Comment) {
    setComments((prev) => [...prev, comment])
  }

  const words = wordCount(editedContent)

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center">
      {/* Sticky header — centered, 680px wide */}
      <div className="sticky top-0 z-10 w-full flex flex-col items-center bg-[#f9fafb]">
        <DecisionHeader
          review={{ ...review, status: currentStatus }}
          onApprove={handleApprove}
          onRequestChanges={() => setShowModal(true)}
          wordCount={words}
        />
      </div>

      {/*
        Outer wrapper is wider than 680px to give room for margin comments.
        Article prose stays at 680px; MarginalComments positions itself
        absolutely in the right gutter.
      */}
      <div className="relative w-full max-w-[960px] px-10 py-10 flex">
        {/* Article column — fixed 680px */}
        <div className="w-[680px] flex flex-col gap-6 shrink-0" ref={editorContainerRef}>
          {/* Agent context — collapsible, shown only when present */}
          {review.context && (
            <details className="bg-white border border-[#e5e7eb] rounded-xl px-4 py-3 group">
              <summary className="text-[13px] font-bold text-[#000000] font-ui cursor-pointer list-none flex items-center justify-between">
                Agent context
                <span className="text-[#9ca3af] text-[11px] font-normal group-open:hidden">show</span>
                <span className="text-[#9ca3af] text-[11px] font-normal hidden group-open:inline">hide</span>
              </summary>
              <p className="mt-2 text-[14px] text-[#6b7280] font-ui leading-[1.5] whitespace-pre-wrap">
                {review.context}
              </p>
            </details>
          )}

          <ContentEditor
            content={editedContent}
            editable={review.access === 'comment_and_edit' && !decided}
            comments={comments}
            onChange={setEditedContent}
            onAddComment={handleAddComment}
            reviewSlug={review.slug}
          />

          {/* Reviewer Note (maps to general feedback) */}
          {!decided && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-bold text-[#000000] font-ui">
                Reviewer Note
              </p>
              <textarea
                className="w-full h-[100px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-3 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af] placeholder:opacity-70"
                placeholder="Add a note before approving or requesting changes…"
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Margin comments — floats to the right of the article column */}
        <MarginalComments comments={comments} containerRef={editorContainerRef} />
      </div>

      {showModal && (
        <RequestChangesModal
          comments={comments}
          generalFeedback={reviewerNote}
          reviewSlug={review.slug}
          onClose={() => setShowModal(false)}
          onSubmit={() => { setDecided(true); setCurrentStatus('changes_requested') }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement server page**

Create `src/app/[slug]/page.tsx`:

```tsx
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
```

- [ ] **Step 5: Implement not-found page**

Create `src/app/[slug]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center justify-center gap-2">
      <p className="text-[13px] text-[#9ca3af] font-ui">404</p>
      <p className="text-[20px] font-medium text-[#000000] font-ui">
        The agent must have eaten this one.
      </p>
      <p className="text-[13px] text-[#9ca3af] font-ui">
        This review doesn't exist — or never made it past the draft stage.
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Verify page loads**

```bash
npm run dev
```

Open `http://localhost:3000/my-first-review` (using slug from Task 7).

Expected: page renders with title, Approve and Request Changes buttons, metadata row, and article content (stub ContentEditor renders nothing — that's correct at this stage).

- [ ] **Step 7: Verify unsaved changes warning in browser**

1. Open a pending review page
2. Edit some text (after Task 11 is done — skip this for now if ContentEditor is still a stub)
3. Try to refresh or close the tab
4. Expected: browser shows "Leave site? Changes you made may not be saved."
5. Complete an approval → try to refresh → expected: no warning

- [ ] **Step 8: Commit**

```bash
git add src/app/\[slug\]/ src/components/ReviewShell.tsx src/components/DecisionHeader.tsx src/components/ContentEditor.tsx src/components/MarginalComments.tsx src/components/RequestChangesModal.tsx
git commit -m "feat: review page server shell, decision header, not-found page, and component stubs"
```

---

## Task 11: Content Editor (Tiptap WYSIWYG)

**Files:**
- Create: `src/components/ContentEditor.tsx`
- Create: `src/components/FloatingToolbar.tsx`
- Create: `src/components/CommentPopover.tsx`

**Interfaces:**
- Consumes: `Comment` from `@/types`, `POST /api/review/[slug]/comment`
- Produces: `ContentEditor` component used by `ReviewShell`. Calls `onChange(markdown)` on every edit and `onAddComment(comment)` after a comment is saved.

**Behaviour:**
- `access = "comment_and_edit"` → Tiptap is editable; BubbleMenu shows formatting buttons + comment icon
- `access = "comment"` → Tiptap is read-only (`editable={false}`); BubbleMenu shows comment icon only
- Markdown is loaded into Tiptap on mount via `tiptap-markdown` (free community package); serialised back to markdown on every change

- [ ] **Step 1: Configure fonts**

Add Instrument Sans (content font only) to `src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body>{children}</body>
    </html>
  )
}
```

Merge both font families into the `theme.extend` object in the generated `tailwind.config.ts` (do NOT replace the whole file — the generated `content` paths array must be preserved):

```ts
// Inside theme.extend — merge with existing keys, don't replace the block
fontFamily: {
  ui: ["'Iowan Old Style'", 'Charter', 'Georgia', 'serif'],
  content: ['var(--font-instrument-sans)', 'sans-serif'],
},
```

- [ ] **Step 2: Implement FloatingToolbar**

Create `src/components/FloatingToolbar.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react'

interface Props {
  editor: Editor
  editable: boolean
  onCommentClick: () => void
}

export default function FloatingToolbar({ editor, editable, onCommentClick }: Props) {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: 'top' }}
      className="flex items-center gap-1 bg-[#000000] rounded-lg px-2 py-1.5 shadow-lg"
    >
      {editable && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <strong className="text-xs font-ui">B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <em className="text-xs font-ui">I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <span className="text-xs line-through font-ui">S</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <span className="text-xs underline font-ui">U</span>
          </ToolbarButton>
          <div className="w-px h-4 bg-white/20 mx-1" />
        </>
      )}
      {/* Comment icon — always visible */}
      <ToolbarButton onClick={onCommentClick} active={false} title="Add comment">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white">
          <path d="M2 2h12v10H9l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </ToolbarButton>
    </BubbleMenu>
  )
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-white transition-colors ${
        active ? 'bg-white/20' : 'hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Implement CommentPopover**

Create `src/components/CommentPopover.tsx`:

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  anchorText: string
  position: { x: number; y: number }
  onSubmit: (body: string) => Promise<void>
  onClose: () => void
}

export default function CommentPopover({ anchorText, position, onSubmit, onClose }: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    await onSubmit(body)
    setSubmitting(false)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-30 bg-white border border-[#e5e7eb] rounded-xl shadow-xl w-80 p-4"
      style={{ top: position.y + 12, left: Math.min(position.x, window.innerWidth - 340) }}
    >
      <p className="text-xs text-[#6b7280] mb-2 font-ui italic truncate">
        "{anchorText.slice(0, 60)}{anchorText.length > 60 ? '…' : ''}"
      </p>
      <textarea
        autoFocus
        rows={3}
        className="w-full border border-[#e5e7eb] rounded-lg p-2 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af]"
        placeholder="Add your comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-sm text-[#6b7280] hover:text-[#000000] font-ui">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          className="px-3 py-1 text-sm font-medium bg-[#000000] text-white rounded-lg hover:bg-[#1f2937] disabled:opacity-40 font-ui"
        >
          {submitting ? 'Saving…' : 'Comment'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement ContentEditor**

Create `src/components/ContentEditor.tsx`:

```tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import FloatingToolbar from './FloatingToolbar'
import CommentPopover from './CommentPopover'
import type { Comment } from '@/types'

interface Props {
  content: string
  editable: boolean
  comments: Comment[]
  onChange: (markdown: string) => void
  onAddComment: (comment: Comment) => void
  reviewSlug: string
}

interface PendingComment {
  anchorText: string
  anchorStart: number
  anchorEnd: number
  position: { x: number; y: number }
}

// Tiptap extension that decorates anchor_text spans with a subtle orange highlight.
// Accepts a ref so the plugin always reads the current comments list, not a stale closure.
const anchorHighlightKey = new PluginKey('anchorHighlight')

function buildAnchorHighlightExtension(commentsRef: { current: Comment[] }) {
  return Extension.create({
    name: 'anchorHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: anchorHighlightKey,
          props: {
            decorations(state) {
              const decos: Decoration[] = []
              const doc = state.doc
              commentsRef.current.forEach(({ anchor_text }) => {
                const searchText = anchor_text
                doc.descendants((node, pos) => {
                  if (!node.isText || !node.text) return
                  let idx = node.text.indexOf(searchText)
                  while (idx !== -1) {
                    decos.push(
                      Decoration.inline(pos + idx, pos + idx + searchText.length, {
                        class: 'bg-orange-100 rounded-sm',
                      })
                    )
                    idx = node.text.indexOf(searchText, idx + 1)
                  }
                })
              })
              return DecorationSet.create(doc, decos)
            },
          },
        }),
      ]
    },
  })
}

export default function ContentEditor({ content, editable, comments, onChange, onAddComment, reviewSlug }: Props) {
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null)
  const commentsRef = useRef<Comment[]>(comments)
  commentsRef.current = comments  // always reflects latest prop value

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Markdown,
      buildAnchorHighlightExtension(commentsRef),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: [
          'font-content outline-none',
          '[&_h1]:text-[24px] [&_h1]:font-medium [&_h1]:text-[#000000] [&_h1]:leading-[1.2] [&_h1]:mb-6',
          '[&_h2]:text-[18px] [&_h2]:font-medium [&_h2]:text-[#000000] [&_h2]:leading-[1.2] [&_h2]:mb-4',
          '[&_p]:text-[14px] [&_p]:text-[#000000] [&_p]:leading-[1.5] [&_p]:mb-6',
          '[&_img]:rounded-xl [&_img]:w-full [&_img]:h-[360px] [&_img]:object-cover [&_img]:mb-6',
          '[&_strong]:font-semibold [&_em]:italic',
        ].join(' '),
      },
    },
    onUpdate({ editor }) {
      onChange(editor.storage.markdown.getMarkdown())
    },
  })

  // Re-render decorations whenever the comments list changes
  useEffect(() => {
    if (!editor) return
    editor.extensionManager.extensions
      .filter((e) => e.name === 'anchorHighlight')
      .forEach(() => editor.view.dispatch(editor.state.tr))
  }, [editor, comments])

  const handleCommentClick = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return

    const anchorText = editor.state.doc.textBetween(from, to, ' ')
    if (!anchorText.trim()) return

    // Get position of the selection for the popover
    const domSelection = window.getSelection()
    const rect = domSelection?.getRangeAt(0)?.getBoundingClientRect()

    setPendingComment({
      anchorText,
      anchorStart: from,
      anchorEnd: to,
      position: { x: rect?.left ?? 0, y: rect?.bottom ?? 0 },
    })
  }, [editor])

  async function submitComment(body: string) {
    if (!pendingComment) return
    const res = await fetch(`/api/review/${reviewSlug}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        anchor_start: pendingComment.anchorStart,
        anchor_end: pendingComment.anchorEnd,
        anchor_text: pendingComment.anchorText,
      }),
    })
    if (!res.ok) return
    const comment: Comment = await res.json()
    onAddComment(comment)
  }

  if (!editor) return null

  return (
    <div className="w-full relative">
      <FloatingToolbar
        editor={editor}
        editable={editable}
        onCommentClick={handleCommentClick}
      />

      <EditorContent editor={editor} />

      {pendingComment && (
        <CommentPopover
          anchorText={pendingComment.anchorText}
          position={pendingComment.position}
          onSubmit={submitComment}
          onClose={() => setPendingComment(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify component props are wired correctly**

`<ContentEditor>` receives `comments` to drive orange anchor highlights — this prop IS used (not unused). `<MarginalComments>` receives the same `comments` array plus `containerRef` for DOM positioning. No changes needed; this step is a confirmation checkpoint.

- [ ] **Step 6: Verify in browser**

1. Open a pending review with `access = "comment_and_edit"`
2. Verify content renders in Instrument Sans, Tiptap is active (cursor appears on click)
3. Select some text → floating toolbar appears → click B → text goes bold
4. Select text → click comment icon → popover appears → type comment → submit → comment appears in panel
5. Open a review with `access = "comment"` → verify no formatting buttons in toolbar, only comment icon
6. Approve the review → verify `final_content` is set in Supabase (check the reviews table in the Supabase dashboard)

- [ ] **Step 7: Commit**

```bash
git add src/components/ContentEditor.tsx src/components/FloatingToolbar.tsx src/components/CommentPopover.tsx src/app/layout.tsx tailwind.config.ts
git commit -m "feat: WYSIWYG content editor with Tiptap, floating toolbar, and inline commenting"
```

---

## Task 12: Marginal Comments + Request Changes Modal

**Files:**
- Create: `src/components/MarginalComments.tsx`
- Create: `src/components/RequestChangesModal.tsx`

**Interfaces:**
- Consumes: `Comment` from `@/types`, `POST /api/decide`
- Produces: `MarginalComments` and `RequestChangesModal` components used by `ReviewShell`

**Behaviour:**
Each comment card floats in the right gutter of the page, vertically aligned with the line of text it anchors to. The page layout is a single centered column (680px prose); comments appear to the right of it in the remaining space of the 960px outer wrapper. If two comments would overlap vertically, the lower one is pushed down.

- [ ] **Step 1: Implement MarginalComments**

Create `src/components/MarginalComments.tsx`:

```tsx
'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { Comment } from '@/types'

interface Props {
  comments: Comment[]
  containerRef: RefObject<HTMLDivElement>
}

interface PositionedComment extends Comment {
  top: number
}

export default function MarginalComments({ comments, containerRef }: Props) {
  const [positioned, setPositioned] = useState<PositionedComment[]>([])

  useEffect(() => {
    if (!containerRef.current || comments.length === 0) {
      setPositioned([])
      return
    }

    const container = containerRef.current

    const result: PositionedComment[] = comments.map((comment) => {
      // Walk text nodes inside the editor to find the anchor text
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let top = 0
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const idx = node.textContent?.indexOf(comment.anchor_text) ?? -1
        if (idx !== -1) {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + comment.anchor_text.length)
          const rect = range.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          top = rect.top - containerRect.top
          break
        }
      }
      return { ...comment, top }
    })

    // Sort by vertical position, then prevent overlap (min 88px gap)
    result.sort((a, b) => a.top - b.top)
    for (let i = 1; i < result.length; i++) {
      if (result[i].top < result[i - 1].top + 88) {
        result[i] = { ...result[i], top: result[i - 1].top + 88 }
      }
    }

    setPositioned(result)
  }, [comments, containerRef])

  if (positioned.length === 0) return null

  return (
    // Sits to the right of the 680px article column; left offset matches article width + gap
    <div className="relative ml-8 flex-1 shrink-0">
      {positioned.map((c) => (
        <div
          key={c.id}
          className="absolute left-0 w-52 bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-3"
          style={{ top: c.top }}
        >
          <p className="text-[11px] text-[#6b7280] italic mb-1 truncate font-ui">
            "{c.anchor_text.slice(0, 50)}{c.anchor_text.length > 50 ? '…' : ''}"
          </p>
          <p className="text-[13px] text-[#000000] leading-[1.4] font-ui">{c.body}</p>
          <p className="text-[11px] text-[#9ca3af] mt-1.5 font-ui">
            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement RequestChangesModal**

Create `src/components/RequestChangesModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Comment } from '@/types'

interface Props {
  comments: Comment[]
  generalFeedback: string    // pre-filled from the Reviewer Note textarea
  reviewSlug: string
  onClose: () => void
  onSubmit: () => void
}

export default function RequestChangesModal({ comments, generalFeedback, reviewSlug, onClose, onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (comments.length === 0 && !generalFeedback.trim()) {
      setError('Add at least one inline comment or write general feedback before requesting changes.')
      return
    }

    setSubmitting(true)
    const res = await fetch(`/api/decide?slug=${reviewSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'changes_requested',
        changes_requested: generalFeedback.trim() || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    onSubmit()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Request Changes</h2>

        {comments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Inline comments ({comments.length})
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-400 italic">"{c.anchor_text.slice(0, 40)}{c.anchor_text.length > 40 ? '…' : ''}"</span>
                  <span className="mx-1 text-gray-300">→</span>
                  {c.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {generalFeedback && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-1 font-ui">
              Reviewer note
            </p>
            <p className="text-sm text-[#000000] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-3 font-ui">
              {generalFeedback}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40"
          >
            {submitting ? 'Sending…' : 'Send to agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify end-to-end flow in browser**

1. Open the review page
2. Select some text → add a comment → verify it appears in the panel
3. Click "Request Changes" → modal shows the comment → optionally add general feedback → click "Send to agent"
4. Verify `decided_at` is set in Supabase (check table in Supabase dashboard)
5. Click "Approve" on a fresh review → verify `decided_at` is set in Supabase (email notifications come in Task 13)

- [ ] **Step 4: Commit**

```bash
git add src/components/MarginalComments.tsx src/components/RequestChangesModal.tsx
git commit -m "feat: marginal comments aligned to anchor text, request changes modal"
```

---

## Task 13: Email Notifications + Share With Agent

**Files:**
- Create: `src/lib/email.ts`
- Modify: `src/app/api/upload/route.ts` — send reviewer notification after insert
- Modify: `src/app/api/decide/route.ts` — send author notification after decision
- Modify: `src/app/api/review/[slug]/resubmit/route.ts` — send reviewer notification after resubmit
- Modify: `src/components/ReviewShell.tsx` — add "Share with your agent" button

**Interfaces:**
- Consumes: `Review` and `Comment` from `@/types`, `buildSummary` from `src/lib/summary.ts`
- Produces: two email functions (`notifyReviewer`, `notifyAuthor`) and a clipboard button in the decided UI

**Two email triggers:**
1. `notifyReviewer` — fires after `POST /api/upload` if `reviewer_email` is set. Tells the reviewer content is ready.
2. `notifyAuthor` — fires after `POST /api/decide`. Tells the agent operator (author) the decision is in, with a copy-paste prompt they can bring back to their agent.

**"Share with your agent" button:**
Shown in `ReviewShell` when `decided = true`. Copies a formatted prompt to the clipboard containing the full review summary — the same markdown that `buildSummary` builds. The operator pastes this into their next Claude conversation to resume the agent.

- [ ] **Step 1: Set up Resend sender domain**

1. Log in to resend.com → Domains → Add Domain
2. Add DNS records they provide to your domain registrar
3. Once verified, create an API key under API Keys
4. Set both values in `.env.local`:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   ```

For local dev without a verified domain, use Resend's test address: `RESEND_FROM_EMAIL=onboarding@resend.dev` — this only sends to your own account's email.

- [ ] **Step 2: Implement `src/lib/email.ts`**

```ts
import { Resend } from 'resend'
import type { Review, Comment } from '@/types'
import { buildSummary } from './summary'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `Content Review <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? ''

export async function notifyReviewer(review: Review): Promise<void> {
  if (!review.reviewer_email || !process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM,
    to: review.reviewer_email,
    subject: `Review requested: ${review.title}`,
    html: `
      <p>An AI agent has submitted content for your review.</p>
      <p><strong>${review.title}</strong></p>
      ${review.context ? `<p><em>Context: ${review.context}</em></p>` : ''}
      <p><a href="${BASE_URL}/${review.slug}">Open review →</a></p>
      <p style="color:#6b7280;font-size:12px">No account needed — just click the link.</p>
    `,
  })
}

export async function notifyAuthor(review: Review, comments: Comment[]): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const summary = buildSummary(review, comments)
  const statusLabel = review.status === 'approved' ? 'Approved' : 'Changes Requested'

  await resend.emails.send({
    from: FROM,
    to: review.author_email,
    subject: `Review complete: ${review.title} — ${statusLabel}`,
    html: `
      <p>Your content has been reviewed.</p>
      <p><strong>${review.title}</strong> — ${statusLabel}</p>
      <p>Copy the summary below and paste it into your agent to continue:</p>
      <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:13px;white-space:pre-wrap">${summary}</pre>
      <p><a href="${BASE_URL}/${review.slug}">View full review →</a></p>
    `,
  })
}
```

- [ ] **Step 3: Call `notifyReviewer` in upload route**

In `src/app/api/upload/route.ts`, after the `createReview` call:

```ts
import { notifyReviewer } from '@/lib/email'

// after insert:
notifyReviewer(review).catch(() => {}) // fire-and-forget — do NOT await, never block the response
```

- [ ] **Step 4: Wire email calls into decide and resubmit routes**

`src/lib/email.ts` now exists — add the imports and calls to the two routes that need them.

In `src/app/api/decide/route.ts`, add the import and call after `updateReviewDecision`:

```ts
// Add to imports at top of file:
import { notifyAuthor } from '@/lib/email'

// Replace the line before revalidatePath with:
const updated = await updateReviewDecision(review.id, validation.data)

notifyAuthor(updated, comments).catch(() => {})

revalidatePath(`/${slug}`)
```

In `src/app/api/review/[slug]/resubmit/route.ts`, add the import and call after `resubmitReview`:

```ts
// Add to imports at top of file:
import { notifyReviewer } from '@/lib/email'

// Replace the line before revalidatePath with:
const updated = await resubmitReview(review.id, content)

notifyReviewer(updated).catch(() => {})

revalidatePath(`/${slug}`)
```

- [ ] **Step 5: Add "Share with your agent" button to ReviewShell**

In `src/components/ReviewShell.tsx`, add clipboard state and the button. Show it only when `decided = true`:

```tsx
const [copied, setCopied] = useState(false)

async function handleCopyForAgent() {
  const res = await fetch(`/api/review/${review.slug}/summary`)
  const text = await res.text()
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

Render below the Reviewer Note section, when decided:

```tsx
{decided && (
  <div className="flex flex-col gap-2 items-start">
    <p className="text-[13px] text-[#6b7280] font-ui">
      Paste this into your agent to continue:
    </p>
    <button
      onClick={handleCopyForAgent}
      className="px-4 py-2 text-sm font-medium bg-[#000000] text-white rounded-lg hover:bg-[#1f2937] transition-colors font-ui"
    >
      {copied ? 'Copied!' : 'Copy summary for agent'}
    </button>
  </div>
)}
```

- [ ] **Step 6: Verify**

1. Upload a review with `reviewer_email` set → confirm reviewer gets an email with the review link
2. Approve the review → confirm author gets an email with the summary in it
3. Click "Copy summary for agent" on the decided page → paste into a text editor and confirm it contains the full summary markdown
4. Upload with no `reviewer_email` → confirm no email error is thrown

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/app/api/upload/route.ts src/app/api/decide/route.ts src/app/api/review/\[slug\]/resubmit/route.ts src/components/ReviewShell.tsx
git commit -m "feat: email notifications and copy-for-agent button"
```

---

## Task 14: Deploy to Vercel

**Files:**
- Modify: `.env.local` (production values)

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create agentic-content-review --private --source=. --push
```

- [ ] **Step 2: Deploy to Vercel**

```bash
npx vercel --prod
```

When prompted:
- Link to existing project? No
- Project name: `agentic-content-review`
- Directory: `.`

- [ ] **Step 3: Set environment variables in Vercel**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_BASE_URL production   # set to https://your-project.vercel.app
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM_EMAIL production      # must be a verified Resend sender domain
```

- [ ] **Step 4: Re-deploy with env vars**

```bash
vercel --prod
```

- [ ] **Step 5: End-to-end smoke test on production**

```bash
curl -s -X POST https://your-project.vercel.app/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Production Test",
    "content": "# Hello\n\nThis is a production test.",
    "content_type": "long_form",
    "access": "comment_and_edit",
    "author_email": "author@example.com"
  }' | jq .
```

Open the returned `review_url` in a browser. Add a comment, approve. Check the Supabase dashboard to confirm the record updated.

- [ ] **Step 6: Final commit**

```bash
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ POST /api/upload with all fields — Task 7
- ✅ Slug generation (server-side, collision with random word) — Task 2
- ✅ Review page /[slug]: header, content area, margin comments — Tasks 10–12
- ✅ PATCH /api/review/[slug]/resubmit — agent pushes revised content to same URL — Task 8
- ✅ not-found page for invalid slugs — Task 10
- ✅ revalidatePath after decide and resubmit — Tasks 8
- ✅ Email: reviewer notified on upload + resubmit, author notified on decision — Task 13
- ✅ "Copy summary for agent" clipboard button on decided page — Task 13
- ✅ Agent context shown to reviewer (collapsible panel) — Task 10
- ✅ access modes: comment / comment_and_edit — Tasks 10, 11
- ✅ Inline comments with anchor_text — Tasks 9, 11
- ✅ Approve flow — Tasks 8, 10
- ✅ Request Changes flow with modal — Tasks 8, 12
- ✅ changes_requested_requires_feedback validation — Task 8
- ✅ GET /api/review/[slug]/summary markdown output — Tasks 6, 8
- ✅ All error codes from spec — Tasks 3, 7, 8, 9
- ✅ Content format support (markdown/plain text, no HTML) — stored as-is, rendered via Tiptap with tiptap-markdown
- ✅ Deploy to Vercel — Task 14
