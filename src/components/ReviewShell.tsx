'use client'

import { useState, useEffect, useRef } from 'react'
import type { Review, Comment } from '@/types'
import DecisionHeader from './DecisionHeader'
import ContentEditor from './ContentEditor'
import MarginalComments from './MarginalComments'
import RequestChangesModal from './RequestChangesModal'

interface Props {
  review: Review
  initialComments: Comment[]
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function ReviewShell({ review, initialComments }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [editedContent, setEditedContent] = useState(review.content)
  const [reviewerNote, setReviewerNote] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [decided, setDecided] = useState(review.status !== 'pending')
  const [currentStatus, setCurrentStatus] = useState(review.status)

  // Warn on unsaved changes
  useEffect(() => {
    const hasChanges =
      !decided &&
      (editedContent !== review.content || comments.length > initialComments.length)
    if (!hasChanges) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [decided, editedContent, review.content, comments.length, initialComments.length])

  async function handleApprove() {
    const res = await fetch(`/api/decide?slug=${review.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved', final_content: editedContent }),
    })
    if (!res.ok) return
    setDecided(true)
    setCurrentStatus('approved')
  }

  function handleAddComment(comment: Comment) {
    setComments((prev) => [...prev, comment])
  }

  const words = wordCount(editedContent)

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center">
      {/* Sticky header — centered, 680px wide */}
      <div className="sticky top-0 z-10 w-full flex flex-col items-center bg-[#f9fafb]">
        <DecisionHeader
          review={{ ...review, status: currentStatus }}
          onApprove={handleApprove}
          onRequestChanges={() => setShowModal(true)}
          wordCount={words}
        />
      </div>

      {/*
        Outer wrapper is wider than 680px to give room for margin comments.
        Article prose stays at 680px; MarginalComments positions itself
        absolutely in the right gutter.
      */}
      <div className="relative w-full max-w-[960px] px-10 py-10 flex">
        {/* Article column — fixed 680px */}
        <div className="w-[680px] flex flex-col gap-6 shrink-0" ref={editorContainerRef}>
          {/* Agent context — collapsible, shown only when present */}
          {review.context && (
            <details className="bg-white border border-[#e5e7eb] rounded-xl px-4 py-3 group">
              <summary className="text-[13px] font-bold text-[#000000] font-ui cursor-pointer list-none flex items-center justify-between">
                Agent context
                <span className="text-[#9ca3af] text-[11px] font-normal group-open:hidden">show</span>
                <span className="text-[#9ca3af] text-[11px] font-normal hidden group-open:inline">hide</span>
              </summary>
              <p className="mt-2 text-[14px] text-[#6b7280] font-ui leading-[1.5] whitespace-pre-wrap">
                {review.context}
              </p>
            </details>
          )}

          <ContentEditor
            content={editedContent}
            editable={review.access === 'comment_and_edit' && !decided}
            comments={comments}
            onChange={setEditedContent}
            onAddComment={handleAddComment}
            reviewSlug={review.slug}
          />

          {/* Reviewer Note (maps to general feedback) */}
          {!decided && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-bold text-[#000000] font-ui">
                Reviewer Note
              </p>
              <textarea
                className="w-full h-[100px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-3 text-[14px] text-[#000000] font-ui resize-none focus:outline-none focus:ring-2 focus:ring-[#000000] placeholder:text-[#9ca3af] placeholder:opacity-70"
                placeholder="Add a note before approving or requesting changes…"
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Margin comments — floats to the right of the article column */}
        <MarginalComments comments={comments} containerRef={editorContainerRef} />
      </div>

      {showModal && (
        <RequestChangesModal
          comments={comments}
          generalFeedback={reviewerNote}
          reviewSlug={review.slug}
          onClose={() => setShowModal(false)}
          onSubmit={() => { setDecided(true); setCurrentStatus('changes_requested') }}
        />
      )}
    </div>
  )
}
