import { describe, it, expect } from 'vitest'
import { adjectives, animals } from 'unique-names-generator'
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
  it('always appends a 4-word random chain, even with no collision', () => {
    const slug = generateSlug('June Newsletter', [])
    expect(slug).not.toBe('june-newsletter')
    const wordPattern = '[a-z]+'
    expect(slug).toMatch(
      new RegExp(`^june-newsletter-${wordPattern}-${wordPattern}-${wordPattern}-${wordPattern}$`)
    )
  })

  it('generates different slugs for the same title (unguessable)', () => {
    const a = generateSlug('June Newsletter', [])
    const b = generateSlug('June Newsletter', [])
    expect(a).not.toBe(b)
  })

  it('uses only words from the adjectives/animals lists', () => {
    const slug = generateSlug('test', [])
    const words = slug.replace('test-', '').split('-')
    expect(words).toHaveLength(4)
    expect(adjectives).toContain(words[0])
    expect(adjectives).toContain(words[1])
    expect(adjectives).toContain(words[2])
    expect(animals).toContain(words[3])
  })

  it('retries when a candidate collides with an existing slug', () => {
    // Fix indices so the first word chain is deterministic, then force a collision
    // on the first attempt so the retry loop advances to a second, distinct chain.
    const first = [0, 1, 2, 0] // adjectives[0], adjectives[1], adjectives[2], animals[0]
    const second = [3, 4, 5, 1] // adjectives[3], adjectives[4], adjectives[5], animals[1]
    const sequence = [...first, ...second]
    let call = 0
    const pickInt = (max: number) => {
      const i = sequence[call++]
      expect(i).toBeLessThan(max)
      return i
    }

    const firstChain = [adjectives[0], adjectives[1], adjectives[2], animals[0]].join('-')
    const secondChain = [adjectives[3], adjectives[4], adjectives[5], animals[1]].join('-')

    const slug = generateSlug('test', [`test-${firstChain}`], pickInt)

    expect(slug).toBe(`test-${secondChain}`)
    expect(call).toBe(8)
  })

  it('falls back to a title-less base for an empty/unslugifiable title', () => {
    const slug = generateSlug('!!!', [])
    expect(slug.startsWith('review-')).toBe(true)
  })

  it('truncates a very long title instead of producing an unbounded slug', () => {
    const longTitle = 'word '.repeat(50).trim() // slugifies to ~250 chars
    const slug = generateSlug(longTitle, [])
    const base = slug.split(/-(?:[a-z]+-[a-z]+-[a-z]+-[a-z]+)$/)[0]
    expect(base.length).toBeLessThanOrEqual(50)
  })

  it('does not chop a word in half when truncating', () => {
    const longTitle = 'a'.repeat(48) + ' longword'
    const slug = generateSlug(longTitle, [])
    expect(slug.startsWith('a'.repeat(48) + '-longword-')).toBe(false)
    expect(slug.startsWith('a'.repeat(48) + '-')).toBe(true)
  })
})
