'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { Review, Comment } from '@/types'
import { buildCommentThreads, collectDescendantIds } from '@/lib/commentTree'
import DecisionHeader from './DecisionHeader'
import ContentEditor from './ContentEditor'
import MarginalComments from './MarginalComments'
import RequestChangesModal from './RequestChangesModal'
import ApproveModal from './ApproveModal'
import Button from './Button'

interface Props {
  review: Review
  initialComments: Comment[]
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function ReviewShell({ review, initialComments }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const baselineContentRef = useRef<string | null>(null)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [editedContent, setEditedContent] = useState(review.content)
  const [editorVersion, setEditorVersion] = useState(0)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [decided, setDecided] = useState(review.status !== 'pending')
  const [currentStatus, setCurrentStatus] = useState(review.status)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // baselineContentRef is null until the editor fires its first onChange (which
    // may differ from review.content due to Tiptap markdown normalization on load).
    // Compare against that normalized baseline, not the raw DB string.
    const baseline = baselineContentRef.current
    const hasChanges = !decided && baseline !== null && editedContent !== baseline
    if (!hasChanges) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [decided, editedContent])

  function handleContentChange(markdown: string) {
    if (baselineContentRef.current === null) baselineContentRef.current = markdown
    setEditedContent(markdown)
  }

  async function handleCopyForAgent() {
    const res = await fetch(`/api/amend/${review.slug}/summary`)
    const text = await res.text()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddComment(comment: Comment) {
    setComments((prev) => [...prev, comment])
  }

  function handleUpdateComment(updated: Comment) {
    setComments((prev) => prev.map((c) => String(c.id) === String(updated.id) ? updated : c))
  }

  function handleDeleteComment(id: string) {
    // Deleting a comment cascades to its replies in the DB (ON DELETE CASCADE) —
    // remove the same subtree from local state so it doesn't leave orphaned
    // replies that would misrender as a bogus new thread.
    setComments((prev) => {
      const toRemove = new Set(collectDescendantIds(prev, id))
      return prev.filter((c) => !toRemove.has(String(c.id)))
    })
  }

  // Only root (anchored) comments can be highlighted in the editor or listed
  // in the "Request Changes" preview — replies have no anchor of their own.
  const rootComments = useMemo(() => comments.filter((c) => c.parent_id === null), [comments])
  const threads = useMemo(() => buildCommentThreads(comments), [comments])

  const words = wordCount(editedContent)

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      {/* Sticky header with bottom border */}
      <div className="sticky top-0 z-10 w-full flex flex-col items-center bg-white">
        <DecisionHeader
          review={{ ...review, status: currentStatus }}
          onApprove={() => setShowApprove(true)}
          onRequestChanges={() => setShowRequestChanges(true)}
          wordCount={words}
        />
      </div>

      {/* Centered article — relative so comments + popover can float right */}
      <div className="w-[680px] relative flex flex-col gap-6 py-10" ref={editorContainerRef}>
        {review.context && (
          <details className="bg-white border border-[#e5e7eb] rounded-md px-4 py-3 group">
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
          comments={rootComments}
          activeCommentId={activeCommentId}
          onChange={handleContentChange}
          onAddComment={handleAddComment}
          onEditorUpdate={() => setEditorVersion(v => v + 1)}
          onActiveCommentChange={setActiveCommentId}
          reviewSlug={review.slug}
        />

        {decided && (
          <div className="flex flex-col gap-2 items-start">
            <p className="text-[13px] text-[#6b7280] font-ui">
              Paste this into your agent to continue:
            </p>
            <Button variant="primary" size="lg" onClick={handleCopyForAgent}>
              {copied ? 'Copied!' : 'Copy summary for agent'}
            </Button>
          </div>
        )}

        {/* Marginal comments float to the right of the article */}
        <MarginalComments
          threads={threads}
          containerRef={editorContainerRef}
          editorVersion={editorVersion}
          activeCommentId={activeCommentId}
          reviewSlug={review.slug}
          onAddComment={handleAddComment}
          onUpdateComment={handleUpdateComment}
          onDeleteComment={handleDeleteComment}
          onSetActiveComment={setActiveCommentId}
          decided={decided}
        />
      </div>

      {showApprove && (
        <ApproveModal
          reviewSlug={review.slug}
          editedContent={editedContent}
          onClose={() => setShowApprove(false)}
          onSubmit={() => { setDecided(true); setCurrentStatus('approved') }}
        />
      )}

      {showRequestChanges && (
        <RequestChangesModal
          comments={rootComments}
          reviewSlug={review.slug}
          onClose={() => setShowRequestChanges(false)}
          onSubmit={() => { setDecided(true); setCurrentStatus('changes_requested') }}
        />
      )}
    </div>
  )
}
