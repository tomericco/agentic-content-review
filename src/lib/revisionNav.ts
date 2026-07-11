// Pure helpers for revision navigation, extracted for unit testing.

export function nextRevisionIndex(
  current: number,
  count: number,
  direction: 'prev' | 'next'
): number | null {
  const target = direction === 'prev' ? current - 1 : current + 1
  if (target < 0 || target > count - 1) return null
  return target
}

// Arrow keys must not switch revisions while the user is moving a text cursor.
// Checks the [contenteditable] attribute via closest() rather than
// isContentEditable, which jsdom doesn't implement.
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  return target.closest('[contenteditable="true"]') !== null
}
