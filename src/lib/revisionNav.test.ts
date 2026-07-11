import { describe, it, expect } from 'vitest'
import { nextRevisionIndex, isTextEntryTarget } from './revisionNav'

describe('nextRevisionIndex', () => {
  it('steps backward and forward within bounds', () => {
    expect(nextRevisionIndex(1, 3, 'prev')).toBe(0)
    expect(nextRevisionIndex(1, 3, 'next')).toBe(2)
  })

  it('returns null at the edges', () => {
    expect(nextRevisionIndex(0, 3, 'prev')).toBeNull()
    expect(nextRevisionIndex(2, 3, 'next')).toBeNull()
  })

  it('returns null for a single-revision review', () => {
    expect(nextRevisionIndex(0, 1, 'prev')).toBeNull()
    expect(nextRevisionIndex(0, 1, 'next')).toBeNull()
  })
})

describe('isTextEntryTarget', () => {
  it('is true for inputs and textareas', () => {
    expect(isTextEntryTarget(document.createElement('input'))).toBe(true)
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true)
  })

  it('is true inside a contenteditable region (the Tiptap editor)', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    const child = document.createElement('p')
    editor.appendChild(child)
    document.body.appendChild(editor)
    expect(isTextEntryTarget(child)).toBe(true)
    document.body.removeChild(editor)
  })

  it('is false for plain elements and null', () => {
    expect(isTextEntryTarget(document.createElement('div'))).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
  })
})
