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
