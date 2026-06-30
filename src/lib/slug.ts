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
