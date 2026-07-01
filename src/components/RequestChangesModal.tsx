'use client'

import { useState } from 'react'
import type { Comment } from '@/types'
import Button from './Button'

interface Props {
  comments: Comment[]
  reviewSlug: string
  onClose: () => void
  onSubmit: () => void
}

export default function RequestChangesModal({ comments, reviewSlug, onClose, onSubmit }: Props) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (comments.length === 0 && !note.trim()) {
      setError('Add at least one inline comment or write a note before requesting changes.')
      return
    }

    setSubmitting(true)
    const res = await fetch(`/api/decide?slug=${reviewSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'changes_requested',
        changes_requested: note.trim() || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    onSubmit()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
      <div className="bg-white rounded-md shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1 font-ui">Request Changes</h2>
        <p className="text-[13px] text-[#6b7280] font-ui mb-4">
          The agent will receive your note and all inline comments.
        </p>

        {comments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 font-ui">
              Inline comments ({comments.length})
            </p>
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.id} className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2 font-ui">
                  <span className="text-gray-400 italic">&quot;{c.anchor_text.slice(0, 40)}{c.anchor_text.length > 40 ? '…' : ''}&quot;</span>
                  <span className="mx-1 text-gray-300">→</span>
                  {c.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <p className="text-[13px] font-medium text-[#000000] font-ui mb-1">
            Note to agent <span className="text-[#9ca3af] font-normal">(optional)</span>
          </p>
          <textarea
            rows={3}
            autoFocus
            className="w-full border border-[#e5e7eb] rounded-md p-3 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af]"
            placeholder="Explain what needs to change…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 mb-3 font-ui">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send to agent'}
          </Button>
        </div>
      </div>
    </div>
  )
}
