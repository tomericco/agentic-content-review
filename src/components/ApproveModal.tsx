'use client'

import { useState } from 'react'
import Button from './Button'

interface Props {
  reviewSlug: string
  editedContent: string
  onClose: () => void
  onSubmit: () => void
}

export default function ApproveModal({ reviewSlug, editedContent, onClose, onSubmit }: Props) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    const res = await fetch(`/api/decide?slug=${reviewSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'approved',
        final_content: editedContent,
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
        <h2 className="text-base font-semibold text-gray-900 mb-1 font-ui">Approve content</h2>
        <p className="text-[13px] text-[#6b7280] font-ui mb-4">
          The agent will receive the final content along with all inline comments, and the review will be closed. This cannot be undone.
        </p>

        <div className="mb-4">
          <p className="text-[13px] font-medium text-[#000000] font-ui mb-1">
            Note to agent <span className="text-[#9ca3af] font-normal">(optional)</span>
          </p>
          <textarea
            rows={3}
            autoFocus
            className="w-full border border-[#e5e7eb] rounded-md p-3 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af]"
            placeholder="Any final notes for the agent…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 mb-3 font-ui">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Approving…' : 'Confirm Approve'}
          </Button>
        </div>
      </div>
    </div>
  )
}
