'use client'

import type { Review } from '@/types'

interface Props {
  review: Review
  onApprove: () => void
  onRequestChanges: () => void
  wordCount: number
}

export default function DecisionHeader({ review, onApprove, onRequestChanges, wordCount }: Props) {
  const isPending = review.status === 'pending'

  const formattedDate = new Date(review.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-2 pt-4 items-center w-full bg-[#f9fafb]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#e5e7eb] rounded-xl shadow-[0px_6px_18px_-6px_rgba(0,0,0,0.05)] w-[680px] h-14 px-6 py-4 flex items-center justify-between shrink-0">
        <p className="text-[#000000] text-base font-normal font-ui truncate">
          {review.title}
        </p>
        {isPending ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onRequestChanges}
              className="px-4 py-1.5 text-sm font-medium text-[#374151] border border-[#e5e7eb] rounded-lg hover:bg-gray-50 transition-colors font-ui"
            >
              Request Changes
            </button>
            <button
              onClick={onApprove}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-[#000000] rounded-lg hover:bg-[#1f2937] transition-colors font-ui"
            >
              Approve
            </button>
          </div>
        ) : (
          <span className="text-[13px] text-[#6b7280] font-ui shrink-0">
            Feedback sent to agent
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="w-[680px] flex items-center justify-between px-3 py-2 text-[13px] text-[#6b7280] font-ui">
        <div className="flex items-center gap-2">
          {review.agent_model && <span>{review.agent_model}</span>}
          {review.agent_model && <span className="text-[#9ca3af]">•</span>}
          <span>{formattedDate}</span>
        </div>
        <span>{wordCount.toLocaleString()} words</span>
      </div>
    </div>
  )
}
