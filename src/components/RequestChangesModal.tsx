'use client'

import { useState } from 'react'
import type { Comment } from '@/types'

interface Props {
  comments: Comment[]
  generalFeedback: string    // pre-filled from the Reviewer Note textarea
  reviewSlug: string
  onClose: () => void
  onSubmit: () => void
}

export default function RequestChangesModal({ comments, generalFeedback, reviewSlug, onClose, onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (comments.length === 0 && !generalFeedback.trim()) {
      setError('Add at least one inline comment or write general feedback before requesting changes.')
      return
    }

    setSubmitting(true)
    const res = await fetch(`/api/decide?slug=${reviewSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'changes_requested',
        changes_requested: generalFeedback.trim() || undefined,
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Request Changes</h2>

        {comments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Inline comments ({comments.length})
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-400 italic">&quot;{c.anchor_text.slice(0, 40)}{c.anchor_text.length > 40 ? '…' : ''}&quot;</span>
                  <span className="mx-1 text-gray-300">→</span>
                  {c.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {generalFeedback && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-1 font-ui">
              Reviewer note
            </p>
            <p className="text-sm text-[#000000] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-3 font-ui">
              {generalFeedback}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40"
          >
            {submitting ? 'Sending…' : 'Send to agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
