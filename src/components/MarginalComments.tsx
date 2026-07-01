'use client'

import { useEffect, useState, useRef, type RefObject } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import Tooltip from './Tooltip'
import type { Comment } from '@/types'

function timeAgo(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

function fullTimestamp(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy, h:mm a')
}

interface Props {
  comments: Comment[]
  containerRef: RefObject<HTMLDivElement | null>
  editorVersion: number
  activeCommentId: string | null
  reviewSlug: string
  onUpdateComment: (updated: Comment) => void
  onDeleteComment: (id: string) => void
  onSetActiveComment: (id: string | null) => void
}

interface PositionedComment extends Comment {
  top: number
}

function CommentCard({
  comment,
  reviewSlug,
  onUpdate,
  onDelete,
}: {
  comment: PositionedComment
  active: boolean
  reviewSlug: string
  onUpdate: (updated: Comment) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [draft, editing])

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(draft.length, draft.length)
    }
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!draft.trim()) { setEditing(false); setDraft(comment.body); return }
    if (draft === comment.body) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/review/${reviewSlug}/comment/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    })
    if (res.ok) onUpdate(await res.json())
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this comment?')) return
    await fetch(`/api/review/${reviewSlug}/comment/${comment.id}`, { method: 'DELETE' })
    onDelete(String(comment.id))
  }

  return (
    <div className="group">
      <p className="text-[11px] text-[#9ca3af] italic mb-1.5 truncate border-l-2 border-amber-300 pl-2">
        &quot;{comment.anchor_text.slice(0, 50)}{comment.anchor_text.length > 50 ? '…' : ''}&quot;
      </p>

      {editing ? (
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full text-[13px] text-[#000000] leading-[1.4] bg-transparent border-0 border-b border-[#d1d5db] outline-none resize-none p-0 m-0 font-[inherit]"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
            if (e.key === 'Escape') { setEditing(false); setDraft(comment.body) }
          }}
          onBlur={handleSave}
        />
      ) : (
        <p className="text-[13px] text-[#000000] leading-[1.4]">{comment.body}</p>
      )}

      <div className="flex items-center justify-between mt-1.5 min-h-[18px]">
        {editing ? (
          <>
            <span className="text-[11px] text-[#9ca3af]">esc cancel</span>
            <button
              className="text-[11px] font-medium text-[#000000] hover:opacity-60 cursor-pointer disabled:opacity-30"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <Tooltip content={fullTimestamp(comment.created_at)}>
              <span className="text-[11px] text-[#9ca3af]">{timeAgo(comment.created_at)}</span>
            </Tooltip>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="text-[11px] text-[#6b7280] hover:text-[#000000] cursor-pointer"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="text-[11px] text-[#6b7280] hover:text-red-500 cursor-pointer"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MarginalComments({ comments, containerRef, editorVersion, activeCommentId, reviewSlug, onUpdateComment, onDeleteComment, onSetActiveComment }: Props) {
  const [positioned, setPositioned] = useState<PositionedComment[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container || comments.length === 0) {
      setPositioned([])
      return
    }

    const containerTop = container.getBoundingClientRect().top

    const result: PositionedComment[] = comments.map((comment) => {
      const el = container.querySelector(`[data-comment-id="${comment.id}"]`)
      let top = 0
      if (el) top = el.getBoundingClientRect().top - containerTop
      return { ...comment, top }
    })

    result.sort((a, b) => a.top - b.top)
    for (let i = 1; i < result.length; i++) {
      if (result[i].top < result[i - 1].top + 88) {
        result[i] = { ...result[i], top: result[i - 1].top + 88 }
      }
    }

    setPositioned(result)
  }, [comments, containerRef, editorVersion])

  if (positioned.length === 0) return null

  return (
    <div className="absolute left-[calc(100%+2rem)] top-0 w-52 pointer-events-none">
      {positioned.map((c) => {
        const isActive = String(c.id) === activeCommentId
        return (
          <div
            key={c.id}
            className="absolute left-0 w-52 bg-white border border-[#e5e7eb] rounded-md shadow-sm p-3 pointer-events-auto transition-transform duration-150 cursor-pointer"
            style={{
              top: c.top,
              transform: isActive ? 'translateX(-10px)' : 'translateX(0)',
            }}
            onClick={() => onSetActiveComment(isActive ? null : String(c.id))}
          >
            <CommentCard
              comment={c}
              active={isActive}
              reviewSlug={reviewSlug}
              onUpdate={onUpdateComment}
              onDelete={(id) => {
                onDeleteComment(id)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
