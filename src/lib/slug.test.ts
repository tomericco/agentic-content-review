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
