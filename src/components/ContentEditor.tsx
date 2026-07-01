'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import FloatingToolbar from './FloatingToolbar'
import CommentPopover from './CommentPopover'
import type { Comment } from '@/types'

interface Props {
  content: string
  editable: boolean
  comments: Comment[]
  onChange: (markdown: string) => void
  onAddComment: (comment: Comment) => void
  reviewSlug: string
}

interface PendingComment {
  anchorText: string
  anchorStart: number
  anchorEnd: number
  viewportTop: number  // viewport-coordinate top of the selection
}

const anchorHighlightKey = new PluginKey('anchorHighlight')

function buildAnchorHighlightExtension(commentsRef: { current: Comment[] }) {
  return Extension.create({
    name: 'anchorHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: anchorHighlightKey,
          props: {
            decorations(state) {
              const decos: Decoration[] = []
              const doc = state.doc
              commentsRef.current.forEach(({ anchor_text }) => {
                doc.descendants((node, pos) => {
                  if (!node.isText || !node.text) return
                  let idx = node.text.indexOf(anchor_text)
                  while (idx !== -1) {
                    decos.push(
                      Decoration.inline(pos + idx, pos + idx + anchor_text.length, {
                        class: 'bg-orange-100 rounded-sm',
                      })
                    )
                    idx = node.text.indexOf(anchor_text, idx + 1)
                  }
                })
              })
              return DecorationSet.create(doc, decos)
            },
          },
        }),
      ]
    },
  })
}

export default function ContentEditor({ content, editable, comments, onChange, onAddComment, reviewSlug }: Props) {
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null)
  const commentsRef = useRef<Comment[]>(comments)
  // Saved from onSelectionUpdate — Tiptap positions + text
  const savedSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null)
  // Saved from mouseup — viewport-coordinate DOMRect of the selection
  const selectionRectRef = useRef<DOMRect | null>(null)
  commentsRef.current = comments

  // Capture the DOM rect of the selection whenever the user finishes a mouse selection.
  // This runs at mouseup time, BEFORE any toolbar button interaction can disturb focus.
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
      buildAnchorHighlightExtension(commentsRef),
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
      if (from === to) return
      const text = ed.state.doc.textBetween(from, to, ' ')
      if (!text.trim()) return
      savedSelectionRef.current = { from, to, text }
    },
    onUpdate({ editor: ed }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((ed.storage as any).markdown.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.extensionManager.extensions
      .filter((e) => e.name === 'anchorHighlight')
      .forEach(() => editor.view.dispatch(editor.state.tr))
  }, [editor, comments])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  const handleCommentClick = useCallback(() => {
    // Try to get selection info — fall back to empty strings/defaults so the
    // box always appears even if selection state was lost.
    const saved = savedSelectionRef.current
    const anchorText = saved?.text ?? ''
    const anchorStart = saved?.from ?? 0
    const anchorEnd = saved?.to ?? 0

    // Try rect sources in order; if all fail, park at top of visible area.
    let viewportTop = 120
    const rect = selectionRectRef.current
    if (rect && rect.height > 0) {
      viewportTop = rect.top
    } else {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const liveRect = sel.getRangeAt(0).getBoundingClientRect()
        if (liveRect.height > 0) viewportTop = liveRect.top
      }
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
    onAddComment(comment)
  }

  if (!editor) return null

  return (
    <div className="w-full">
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
