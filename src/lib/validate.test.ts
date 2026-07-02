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

  it('rejects whitespace-only content', () => {
    const result = validateUpload({ ...validUpload, content: '   \n\t  ' })
    expect('error' in result && result.code).toBe('missing_field:content')
  })

  it('rejects whitespace-only title', () => {
    const result = validateUpload({ ...validUpload, title: '   ' })
    expect('error' in result && result.code).toBe('missing_field:title')
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

  it('rejects malformed author_email', () => {
    const result = validateUpload({ ...validUpload, author_email: 'not-an-email' })
    expect('error' in result && result.code).toBe('invalid_email:author_email')
  })

  it('accepts valid reviewer_email', () => {
    const result = validateUpload({ ...validUpload, reviewer_email: 'reviewer@example.com' })
    expect('data' in result).toBe(true)
  })

  it('rejects malformed reviewer_email', () => {
    const result = validateUpload({ ...validUpload, reviewer_email: 'not-an-email' })
    expect('error' in result && result.code).toBe('invalid_email:reviewer_email')
  })

  it('accepts omitted reviewer_email', () => {
    const result = validateUpload(validUpload)
    expect('data' in result).toBe(true)
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
