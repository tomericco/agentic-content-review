'use client'

import { formatDistanceToNow, format } from 'date-fns'
import type { Review } from '@/types'
import Button from './Button'
import Tooltip from './Tooltip'

interface Props {
  review: Review
  revisionNumber: number
  revisionCount: number
  revisionCreatedAt: string
  viewingLatest: boolean
  onNavigateRevision: (direction: 'prev' | 'next') => void
  onBackToLatest: () => void
  onApprove: () => void
  onRequestChanges: () => void
  onOpenContext: () => void
  wordCount: number
}

export default function DecisionHeader({
  review,
  revisionNumber,
  revisionCount,
  revisionCreatedAt,
  viewingLatest,
  onNavigateRevision,
  onBackToLatest,
  onApprove,
  onRequestChanges,
  onOpenContext,
  wordCount,
}: Props) {
  const isPending = review.status === 'pending'
  const timeAgo = formatDistanceToNow(new Date(revisionCreatedAt), { addSuffix: true })
  const fullDate = format(new Date(revisionCreatedAt), 'MMM d, yyyy, h:mm a')

  return (
    <div className="flex flex-col gap-2 pt-4 items-center w-full bg-white">
      <div className="bg-white border border-[#e5e7eb] rounded-md shadow-[0px_6px_18px_-6px_rgba(0,0,0,0.05)] w-[680px] h-14 px-6 py-4 flex items-center justify-between gap-8 shrink-0">
        <p className="text-[#000000] text-base font-normal font-ui truncate">
          {review.title}
        </p>
        {!viewingLatest ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] text-[#6b7280] font-ui">
              Viewing revision {revisionNumber} of {revisionCount}
            </span>
            <Button variant="secondary" size="md" onClick={onBackToLatest}>
              Back to latest
            </Button>
          </div>
        ) : isPending ? (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="md" onClick={onRequestChanges}>
              Request Changes
            </Button>
            <Button variant="primary" size="md" onClick={onApprove}>
              Approve
            </Button>
          </div>
        ) : (
          <span className="text-[13px] text-[#6b7280] font-ui shrink-0">
            Feedback sent to agent
          </span>
        )}
      </div>

      <div className="w-[680px] flex items-center justify-between px-3 py-2 text-[13px] text-[#6b7280] font-ui">
        <div className="flex items-center gap-2">
          {revisionCount > 1 && (
            <>
              <span className="inline-flex items-center gap-1">
                <button
                  aria-label="Previous revision"
                  className="px-1 cursor-pointer text-[#6b7280] hover:text-[#000000] disabled:opacity-30 disabled:cursor-default"
                  disabled={revisionNumber === 1}
                  onClick={() => onNavigateRevision('prev')}
                >
                  ‹
                </button>
                <span>Rev {revisionNumber} of {revisionCount}</span>
                <button
                  aria-label="Next revision"
                  className="px-1 cursor-pointer text-[#6b7280] hover:text-[#000000] disabled:opacity-30 disabled:cursor-default"
                  disabled={revisionNumber === revisionCount}
                  onClick={() => onNavigateRevision('next')}
                >
                  ›
                </button>
              </span>
              <span className="text-[#9ca3af]">•</span>
            </>
          )}
          {review.agent_model && <span>{review.agent_model}</span>}
          {review.agent_model && <span className="text-[#9ca3af]">•</span>}
          <Tooltip content={fullDate}>
            Submitted {timeAgo}
          </Tooltip>
          {review.context && (
            <>
              <span className="text-[#9ca3af]">•</span>
              <button
                className="underline cursor-pointer hover:text-[#000000]"
                onClick={onOpenContext}
              >
                Agent context
              </button>
            </>
          )}
        </div>
        <span>{wordCount.toLocaleString()} words</span>
      </div>
    </div>
  )
}
