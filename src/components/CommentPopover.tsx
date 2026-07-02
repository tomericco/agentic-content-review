'use client'

import { useRef, useEffect, useState } from 'react'
import Button from './Button'
import { getDisplayName, setDisplayName } from '@/lib/displayName'

interface Props {
  anchorText: string
  viewportTop: number
  onSubmit: (body: string, authorName: string) => Promise<void>
  onClose: () => void
}

export default function CommentPopover({ anchorText, viewportTop, onSubmit, onClose }: Props) {
  const [body, setBody] = useState('')
  const [name, setName] = useState(() => getDisplayName())
  const [editingName, setEditingName] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Attach the dismiss listener on the next tick so the opening click
    // (which triggered this mount) doesn't immediately close the popover.
    const id = setTimeout(() => {
      function handle(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose()
      }
      document.addEventListener('mousedown', handle)
      return () => document.removeEventListener('mousedown', handle)
    }, 0)
    return () => clearTimeout(id)
  }, [onClose])

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    await onSubmit(body, name)
    setSubmitting(false)
    onClose()
  }

  // Clamp: don't go above the header (~100px) or off the bottom
  const top = Math.max(100, Math.min(viewportTop, window.innerHeight - 220))

  return (
    <div
      ref={ref}
      className="fixed z-30 bg-white border border-[#e5e7eb] rounded-lg shadow-lg w-64 p-3 flex flex-col gap-2"
      style={{
        top,
        // Right of the centered 680px article
        left: 'calc(50vw + 340px + 16px)',
      }}
    >
      {anchorText && (
        <p className="text-[11px] text-[#9ca3af] font-ui italic truncate border-l-2 border-amber-300 pl-2">
          {anchorText.length > 50 ? anchorText.slice(0, 50) + '…' : anchorText}
        </p>
      )}
      <p className="text-[11px] text-[#9ca3af] font-ui">
        Commenting as{' '}
        {editingName ? (
          <input
            autoFocus
            className="text-[11px] text-[#374151] font-medium bg-transparent border-b border-[#d1d5db] outline-none w-24"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setEditingName(false); if (name.trim()) setDisplayName(name) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setEditingName(false); if (name.trim()) setDisplayName(name) }
            }}
          />
        ) : (
          <>
            <span className="font-medium text-[#374151]">{name}</span>{' '}
            <button type="button" className="underline cursor-pointer" onClick={() => setEditingName(true)}>edit</button>
          </>
        )}
      </p>
      <textarea
        autoFocus
        rows={3}
        className="w-full text-[13px] text-[#000000] font-ui resize-none focus:outline-none placeholder:text-[#9ca3af] leading-relaxed"
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="flex justify-end gap-1.5 pt-1 border-t border-[#f3f4f6]">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
        >
          {submitting ? 'Saving…' : 'Comment'}
        </Button>
      </div>
    </div>
  )
}
