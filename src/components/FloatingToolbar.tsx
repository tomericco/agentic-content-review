'use client'

import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'

interface Props {
  editor: Editor
  editable: boolean
  onCommentClick: () => void
}

export default function FloatingToolbar({ editor, editable, onCommentClick }: Props) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      className="flex items-center gap-1 bg-[#000000] rounded-lg px-2 py-1.5 shadow-lg"
    >
      {editable && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <strong className="text-xs font-ui">B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <em className="text-xs font-ui">I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <span className="text-xs line-through font-ui">S</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <span className="text-xs underline font-ui">U</span>
          </ToolbarButton>
          <div className="w-px h-4 bg-white/20 mx-1" />
        </>
      )}
      {/* Comment icon — always visible */}
      <ToolbarButton onClick={onCommentClick} active={false} title="Add comment">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white">
          <path d="M2 2h12v10H9l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </ToolbarButton>
    </BubbleMenu>
  )
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-white transition-colors ${
        active ? 'bg-white/20' : 'hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}
