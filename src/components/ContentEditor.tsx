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
  position: { x: number; y: number }
}

// Tiptap extension that decorates anchor_text spans with a subtle orange highlight.
// Accepts a ref so the plugin always reads the current comments list, not a stale closure.
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
                const searchText = anchor_text
                doc.descendants((node, pos) => {
                  if (!node.isText || !node.text) return
                  let idx = node.text.indexOf(searchText)
                  while (idx !== -1) {
                    decos.push(
                      Decoration.inline(pos + idx, pos + idx + searchText.length, {
                        class: 'bg-orange-100 rounded-sm',
                      })
                    )
                    idx = node.text.indexOf(searchText, idx + 1)
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
  commentsRef.current = comments  // always reflects latest prop value

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
        ].join(' '),
      },
    },
    onUpdate({ editor }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown())
    },
  })

  // Re-render decorations whenever the comments list changes
  useEffect(() => {
    if (!editor) return
    editor.extensionManager.extensions
      .filter((e) => e.name === 'anchorHighlight')
      .forEach(() => editor.view.dispatch(editor.state.tr))
  }, [editor, comments])

  const handleCommentClick = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return

    const anchorText = editor.state.doc.textBetween(from, to, ' ')
    if (!anchorText.trim()) return

    // Get position of the selection for the popover
    const domSelection = window.getSelection()
    const rect = domSelection?.getRangeAt(0)?.getBoundingClientRect()

    setPendingComment({
      anchorText,
      anchorStart: from,
      anchorEnd: to,
      position: { x: rect?.left ?? 0, y: rect?.bottom ?? 0 },
    })
  }, [editor])

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
    <div className="w-full relative">
      <FloatingToolbar
        editor={editor}
        editable={editable}
        onCommentClick={handleCommentClick}
      />

      <EditorContent editor={editor} />

      {pendingComment && (
        <CommentPopover
          anchorText={pendingComment.anchorText}
          position={pendingComment.position}
          onSubmit={submitComment}
          onClose={() => setPendingComment(null)}
        />
      )}
    </div>
  )
}
