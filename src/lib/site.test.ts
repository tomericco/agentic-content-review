import { describe, it, expect } from 'vitest'
import { normalizeBaseUrl } from './site'

describe('normalizeBaseUrl', () => {
  it('leaves an https URL unchanged', () => {
    expect(normalizeBaseUrl('https://www.amend.to')).toBe('https://www.amend.to')
  })

  it('leaves an http URL unchanged', () => {
    expect(normalizeBaseUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('prepends https:// to a protocol-less host', () => {
    expect(normalizeBaseUrl('www.amend.to')).toBe('https://www.amend.to')
  })

  it('produces a value new URL() can parse', () => {
    expect(() => new URL(normalizeBaseUrl('www.amend.to'))).not.toThrow()
  })
})
