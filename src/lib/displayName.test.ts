import { describe, it, expect, beforeEach } from 'vitest'
import { getDisplayName, setDisplayName } from './displayName'

describe('getDisplayName / setDisplayName', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('generates and persists a name on first call', () => {
    const name = getDisplayName()
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    expect(localStorage.getItem('amend:display_name')).toBe(name)
  })

  it('returns the same stored name on subsequent calls', () => {
    const first = getDisplayName()
    const second = getDisplayName()
    expect(second).toBe(first)
  })

  it('setDisplayName overrides the stored name', () => {
    getDisplayName()
    setDisplayName('Jane')
    expect(getDisplayName()).toBe('Jane')
  })

  it('setDisplayName trims whitespace', () => {
    setDisplayName('  Jane  ')
    expect(getDisplayName()).toBe('Jane')
  })

  it('setDisplayName ignores an empty/whitespace-only name', () => {
    setDisplayName('Jane')
    setDisplayName('   ')
    expect(getDisplayName()).toBe('Jane')
  })
})
