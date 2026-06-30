'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  anchorText: string
  position: { x: number; y: number }
  onSubmit: (body: string) => Promise<void>
  onClose: () => void
}

export default function CommentPopover({ anchorText, position, onSubmit, onClose }: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    await onSubmit(body)
    setSubmitting(false)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-30 bg-white border border-[#e5e7eb] rounded-xl shadow-xl w-80 p-4"
      style={{ top: position.y + 12, left: Math.min(position.x, window.innerWidth - 340) }}
    >
      <p className="text-xs text-[#6b7280] mb-2 font-ui italic truncate">
        &ldquo;{anchorText.slice(0, 60)}{anchorText.length > 60 ? '…' : ''}&rdquo;
      </p>
      <textarea
        autoFocus
        rows={3}
        className="w-full border border-[#e5e7eb] rounded-lg p-2 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af]"
        placeholder="Add your comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-sm text-[#6b7280] hover:text-[#000000] font-ui">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          className="px-3 py-1 text-sm font-medium bg-[#000000] text-white rounded-lg hover:bg-[#1f2937] disabled:opacity-40 font-ui"
        >
          {submitting ? 'Saving…' : 'Comment'}
        </button>
      </div>
    </div>
  )
}
