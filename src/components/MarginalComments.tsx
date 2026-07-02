'use client'

import { useEffect, useState, useRef, useLayoutEffect, type RefObject } from 'react'
import { format } from 'date-fns'
import { format as timeagoFormat, register as registerTimeagoLocale } from 'timeago.js'
import timeagoEnShort from 'timeago.js/esm/lang/en_short'
import Tooltip from './Tooltip'
import { getDisplayName, setDisplayName } from '@/lib/displayName'
import type { Comment } from '@/types'
import type { CommentThread } from '@/lib/commentTree'

registerTimeagoLocale('en_short', timeagoEnShort)

// Compact relative time (e.g. "1h ago", "3d ago") — the full "1 hour ago"
// format from date-fns wraps to two lines in the narrow comment card.
// Scoped to comments only — the rest of the app doesn't use relative time.
function timeAgo(dateStr: string): string {
  return timeagoFormat(new Date(dateStr), 'en_short') as string
}

function fullTimestamp(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy, h:mm a')
}

// Fallback vertical gap used until a card has been measured at least once.
const FALLBACK_CARD_HEIGHT = 88
const CARD_GAP = 12

interface Props {
  threads: CommentThread[]
  containerRef: RefObject<HTMLDivElement | null>
  editorVersion: number
  activeCommentId: string | null
  reviewSlug: string
  onAddComment: (comment: Comment) => void
  onUpdateComment: (updated: Comment) => void
  onDeleteComment: (id: string) => void
  onSetActiveComment: (id: string | null) => void
  decided: boolean
}

interface PositionedThread extends CommentThread {
  top: number
}

// One row within a thread card: the root comment, or one of its flat replies.
function CommentRow({
  comment,
  reviewSlug,
  onUpdate,
  onDelete,
  onReply,
  showAnchor,
}: {
  comment: Comment
  reviewSlug: string
  onUpdate: (updated: Comment) => void
  onDelete: (id: string) => void
  onReply: (id: string) => void
  showAnchor: boolean
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
    const res = await fetch(`/api/amend/${reviewSlug}/comment/${comment.id}`, {
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
    await fetch(`/api/amend/${reviewSlug}/comment/${comment.id}`, { method: 'DELETE' })
    onDelete(String(comment.id))
  }

  return (
    <div className="group">
      {showAnchor && comment.anchor_text && (
        <p className="text-[11px] text-[#9ca3af] italic mb-1.5 truncate border-l-2 border-amber-300 pl-2">
          &quot;{comment.anchor_text.slice(0, 50)}{comment.anchor_text.length > 50 ? '…' : ''}&quot;
        </p>
      )}

      {comment.author_name && (
        <p className="text-[11px] font-medium text-[#374151] mb-0.5">{comment.author_name}</p>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full text-[13px] text-[#000000] leading-[1.4] bg-transparent border-0 outline-none resize-none p-0 m-0 font-[inherit]"
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
                onClick={() => onReply(String(comment.id))}
              >
                Reply
              </button>
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

// Always appended at the bottom of a thread's flat reply list, regardless of
// which row's "Reply" was clicked — parent_id (passed in via onSubmit) is
// what actually records the real reply-to relationship.
function ReplyComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string, authorName: string) => Promise<void>
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [name, setName] = useState(() => getDisplayName())
  const [editingName, setEditingName] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit() {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    await onSubmit(body, name)
    setSubmitting(false)
  }

  return (
    <div className="border-t border-[#f3f4f6] pt-2 mt-1">
      <p className="text-[11px] text-[#9ca3af] mb-1">
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
            <button className="underline cursor-pointer" onClick={() => setEditingName(true)}>edit</button>
          </>
        )}
      </p>
      <textarea
        ref={textareaRef}
        rows={2}
        className="w-full text-[13px] text-[#000000] leading-[1.4] bg-transparent border-0 outline-none resize-none p-0 m-0 font-[inherit]"
        placeholder="Reply…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-[#9ca3af]">esc cancel</span>
        <button
          className="text-[11px] font-medium text-[#000000] hover:opacity-60 cursor-pointer disabled:opacity-30"
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
        >
          {submitting ? 'Saving…' : 'Reply'}
        </button>
      </div>
    </div>
  )
}

function ThreadCard({
  thread,
  reviewSlug,
  decided,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onMeasured,
}: {
  thread: PositionedThread
  reviewSlug: string
  decided: boolean
  onAddComment: (comment: Comment) => void
  onUpdateComment: (updated: Comment) => void
  onDeleteComment: (id: string) => void
  onMeasured: (height: number) => void
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height) onMeasured(height)
    })
    observer.observe(el)
    onMeasured(el.getBoundingClientRect().height)
    return () => observer.disconnect()
  }, [onMeasured])

  async function submitReply(body: string, authorName: string) {
    const res = await fetch(`/api/amend/${reviewSlug}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, parent_id: replyingTo, author_name: authorName || null }),
    })
    if (res.ok) {
      onAddComment(await res.json())
      setReplyingTo(null)
    }
  }

  return (
    <div ref={cardRef} className="bg-white border border-[#e5e7eb] rounded-md shadow-sm p-3 flex flex-col gap-2">
      <CommentRow
        comment={thread.root}
        reviewSlug={reviewSlug}
        onUpdate={onUpdateComment}
        onDelete={onDeleteComment}
        onReply={setReplyingTo}
        showAnchor
      />
      {thread.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          reviewSlug={reviewSlug}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          onReply={setReplyingTo}
          showAnchor={false}
        />
      ))}
      {!decided && replyingTo && (
        <ReplyComposer onSubmit={submitReply} onCancel={() => setReplyingTo(null)} />
      )}
    </div>
  )
}

export default function MarginalComments({ threads, containerRef, editorVersion, activeCommentId, reviewSlug, onAddComment, onUpdateComment, onDeleteComment, onSetActiveComment, decided }: Props) {
  const [anchorTops, setAnchorTops] = useState<Record<string, number>>({})
  const [heights, setHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    const container = containerRef.current
    if (!container || threads.length === 0) {
      setAnchorTops({})
      return
    }

    const containerTop = container.getBoundingClientRect().top
    const next: Record<string, number> = {}
    threads.forEach((thread) => {
      const el = container.querySelector(`[data-comment-id="${thread.root.id}"]`)
      next[thread.root.id] = el ? el.getBoundingClientRect().top - containerTop : 0
    })
    setAnchorTops(next)
  }, [threads, containerRef, editorVersion])

  if (threads.length === 0) return null

  // Stack cards top-to-bottom by anchor position, pushing a card down if it
  // would overlap the previous one's real measured height (falls back to
  // FALLBACK_CARD_HEIGHT until a card has been measured at least once —
  // necessary since reply threads make card height highly variable).
  const ordered = [...threads].sort(
    (a, b) => (anchorTops[a.root.id] ?? 0) - (anchorTops[b.root.id] ?? 0)
  )
  const positioned: PositionedThread[] = []
  ordered.forEach((thread, i) => {
    const anchorTop = anchorTops[thread.root.id] ?? 0
    if (i === 0) {
      positioned.push({ ...thread, top: anchorTop })
      return
    }
    const prev = positioned[i - 1]
    const prevHeight = heights[prev.root.id] ?? FALLBACK_CARD_HEIGHT
    const top = Math.max(anchorTop, prev.top + prevHeight + CARD_GAP)
    positioned.push({ ...thread, top })
  })

  return (
    <div className="absolute left-[calc(100%+2rem)] top-0 w-52 pointer-events-none">
      {positioned.map((thread) => {
        const isActive = String(thread.root.id) === activeCommentId
        return (
          <div
            key={thread.root.id}
            className="absolute left-0 w-52 pointer-events-auto transition-transform duration-150"
            style={{
              top: thread.top,
              transform: isActive ? 'translateX(-10px)' : 'translateX(0)',
            }}
            onClick={() => onSetActiveComment(isActive ? null : String(thread.root.id))}
          >
            <ThreadCard
              thread={thread}
              reviewSlug={reviewSlug}
              decided={decided}
              onAddComment={onAddComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onMeasured={(height) =>
                setHeights((prev) => (prev[thread.root.id] === height ? prev : { ...prev, [thread.root.id]: height }))
              }
            />
          </div>
        )
      })}
    </div>
  )
}
