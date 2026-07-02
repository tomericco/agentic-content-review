import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator'

const DISPLAY_NAME_KEY = 'amend:display_name'

// Client-only: a friendly per-browser display name for comments/replies so a
// shared review link with no login still reads as a real conversation. This
// is purely cosmetic (unlike the review slug), so the library's own
// Math.random()-based picker is fine here.
function generateDisplayName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    style: 'capital',
    separator: ' ',
    length: 2,
  })
}

export function getDisplayName(): string {
  const stored = localStorage.getItem(DISPLAY_NAME_KEY)
  if (stored) return stored
  const generated = generateDisplayName()
  localStorage.setItem(DISPLAY_NAME_KEY, generated)
  return generated
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  localStorage.setItem(DISPLAY_NAME_KEY, trimmed)
}
