import { randomInt } from 'crypto'
import { adjectives, animals } from 'unique-names-generator'

// Picks a uniform random integer in [0, max). Injectable so tests can supply
// a deterministic picker without mocking Node's crypto module.
export type IntPicker = (max: number) => number

// unique-names-generator's own picker uses Math.random(), which isn't
// unguessable enough to be an access-control token — pick indices ourselves
// with crypto.randomInt (uniform, no modulo bias) but keep its curated,
// readable word lists.
function cryptoPickInt(max: number): number {
  return randomInt(max)
}

function randomWord(list: string[], pickInt: IntPicker): string {
  return list[pickInt(list.length)]
}

// 3 adjectives (1202 words, ~10.2 bits each) + 1 animal (355 words, ~8.5 bits)
// ~= 39 bits of entropy. The slug is the only access control on a review
// (see docs), so it must never be derivable from the title alone — this
// word chain is what makes it unguessable, not the title-derived prefix,
// which exists purely for readability.
function randomWordChain(pickInt: IntPicker): string {
  return [randomWord(adjectives, pickInt), randomWord(adjectives, pickInt), randomWord(adjectives, pickInt), randomWord(animals, pickInt)].join('-')
}

const MAX_SLUG_BASE_LENGTH = 50

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Titles have no length limit at the API layer, but the slug is a URL and a
// UI label — cap the readable prefix so one very long title can't produce an
// unbounded slug. Cuts at a hyphen boundary so it doesn't chop a word in half.
function truncateBase(base: string, maxLength = MAX_SLUG_BASE_LENGTH): string {
  if (base.length <= maxLength) return base
  const truncated = base.slice(0, maxLength)
  const lastHyphen = truncated.lastIndexOf('-')
  return (lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated).replace(/-+$/, '')
}

export function generateSlug(title: string, existingSlugs: string[], pickInt: IntPicker = cryptoPickInt): string {
  const base = truncateBase(slugify(title)) || 'review'
  const taken = new Set(existingSlugs)

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomWordChain(pickInt)}`
    if (!taken.has(candidate)) return candidate
  }

  // Astronomically unlikely fallback: a longer chain instead of looping forever.
  return `${base}-${randomWordChain(pickInt)}-${randomWordChain(pickInt)}`
}
