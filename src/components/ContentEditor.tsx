'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import FloatingToolbar from './FloatingToolbar'
import CommentPopover from './CommentPopover'
import { buildCommentHighlightExtension, commentHighlightKey, makeCommentDeco } from './commentHighlightPlugin'
import type { DecorationSet } from '@tiptap/pm/view'
import type { Comment } from '@/types'

interface Props {
  content: string
  editable: boolean
  comments: Comment[]
  activeCommentId: string | null
  onChange: (markdown: string) => void
  onAddComment: (comment: Comment) => void
  onEditorUpdate: () => void
  onActiveCommentChange: (id: string | null) => void
  reviewSlug: string
}

interface PendingComment {
  anchorText: string
  anchorStart: number
  anchorEnd: number
  viewportTop: number
}

export default function ContentEditor({ content, editable, comments, activeCommentId, onChange, onAddComment, onEditorUpdate, onActiveCommentChange, reviewSlug }: Props) {
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null)
  const savedSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null)
  const selectionRectRef = useRef<DOMRect | null>(null)
  // Ref so onSelectionUpdate always calls the current callback without stale closure
  const onActiveCommentChangeRef = useRef(onActiveCommentChange)
  onActiveCommentChangeRef.current = onActiveCommentChange

  // Capture selection rect on mouseup — before toolbar interactions disturb focus.
  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (rect.width > 0) selectionRectRef.current = rect
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Markdown,
      buildCommentHighlightExtension(comments),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: [
          'font-content outline-none',
          '[&_h1]:text-[24px] [&_h1]:font-medium [&_h1]:text-[#000000] [&_h1]:leading-[1.2] [&_h1]:mb-6',
          '[&_h2]:text-[18px] [&_h2]:font-medium [&_h2]:text-[#000000] [&_h2]:leading-[1.2] [&_h2]:mb-4',
          '[&_p]:text-[14px] [&_p]:text-[#000000] [&_p]:leading-[1.5] [&_p]:mb-6',
          '[&_img]:rounded-xl [&_img]:w-full [&_img]:h-[360px] [&_img]:object-cover [&_img]:mb-6',
          '[&_strong]:font-semibold [&_em]:italic',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-6 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-6',
          '[&_li]:text-[14px] [&_li]:text-[#000000] [&_li]:leading-[1.5] [&_li]:mb-1',
        ].join(' '),
      },
    },
    onSelectionUpdate({ editor: ed }) {
      const { from, to } = ed.state.selection
      // Save selection for comment anchor
      if (from !== to) {
        const text = ed.state.doc.textBetween(from, to, ' ')
        if (text.trim()) savedSelectionRef.current = { from, to, text }
      }
      // Detect active comment — use ref to avoid stale closure
      if (from === to) {
        const decoSet = commentHighlightKey.getState(ed.state) as DecorationSet | undefined
        const decos = decoSet?.find(Math.max(0, from - 1), from + 1) ?? []
        const activeId = (decos[0]?.spec as Record<string, string> | undefined)?.['data-comment-id'] ?? null
        onActiveCommentChangeRef.current(activeId)
      }
    },
    onUpdate({ editor: ed }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((ed.storage as any).markdown.getMarkdown())
      onEditorUpdate()
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])


  const handleCommentClick = useCallback(() => {
    const saved = savedSelectionRef.current
    const anchorText = saved?.text ?? ''
    const anchorStart = saved?.from ?? 0
    const anchorEnd = saved?.to ?? 0

    // e.preventDefault() on the toolbar button keeps focus and DOM selection alive.
    let viewportTop = 120
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (rect.height > 0) viewportTop = rect.top
    } else if (selectionRectRef.current?.height) {
      viewportTop = selectionRectRef.current.top
    }

    setPendingComment({ anchorText, anchorStart, anchorEnd, viewportTop })
  }, [])

  async function submitComment(body: string) {
    if (!pendingComment) return
    const res = await fetch(`/api/review/${reviewSlug}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        anchor_start: pendingComment.anchorStart,
        anchor_end: pendingComment.anchorEnd,
        anchor_text: pendingComment.anchorText,
      }),
    })
    if (!res.ok) return
    const comment: Comment = await res.json()

    // Apply the highlight decoration at the exact positions we used — no text search needed.
    if (editor && pendingComment.anchorStart !== pendingComment.anchorEnd) {
      editor.view.dispatch(
        editor.state.tr.setMeta(commentHighlightKey, [
          makeCommentDeco(pendingComment.anchorStart, pendingComment.anchorEnd, comment.id),
        ])
      )
    }

    onAddComment(comment)
    setPendingComment(null)
  }

  if (!editor) return null

  return (
    <div className="w-full">
      {activeCommentId && (
        <style>{`.comment-highlight[data-comment-id="${activeCommentId}"] { background-color: #f6b519; }`}</style>
      )}
      <FloatingToolbar
        editor={editor}
        editable={editable}
        onCommentClick={handleCommentClick}
      />

      <EditorContent editor={editor} />

      {pendingComment && (
        <CommentPopover
          anchorText={pendingComment.anchorText}
          viewportTop={pendingComment.viewportTop}
          onSubmit={submitComment}
          onClose={() => setPendingComment(null)}
        />
      )}
    </div>
  )
}
