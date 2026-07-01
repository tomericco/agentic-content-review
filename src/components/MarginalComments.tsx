'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { Comment } from '@/types'

interface Props {
  comments: Comment[]
  containerRef: RefObject<HTMLDivElement | null>
}

interface PositionedComment extends Comment {
  top: number
}

export default function MarginalComments({ comments, containerRef }: Props) {
  const [positioned, setPositioned] = useState<PositionedComment[]>([])

  useEffect(() => {
    if (!containerRef.current || comments.length === 0) {
      setPositioned([])
      return
    }

    const container = containerRef.current

    const result: PositionedComment[] = comments.map((comment) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let top = 0
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const idx = node.textContent?.indexOf(comment.anchor_text) ?? -1
        if (idx !== -1) {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + comment.anchor_text.length)
          const rect = range.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          top = rect.top - containerRect.top
          break
        }
      }
      return { ...comment, top }
    })

    result.sort((a, b) => a.top - b.top)
    for (let i = 1; i < result.length; i++) {
      if (result[i].top < result[i - 1].top + 88) {
        result[i] = { ...result[i], top: result[i - 1].top + 88 }
      }
    }

    setPositioned(result)
  }, [comments, containerRef])

  if (positioned.length === 0) return null

  return (
    <div className="absolute left-[calc(100%+2rem)] top-0 w-52 pointer-events-none">
      {positioned.map((c) => (
        <div
          key={c.id}
          className="absolute left-0 w-52 bg-white border border-[#e5e7eb] rounded-md shadow-sm p-3 pointer-events-auto"
          style={{ top: c.top }}
        >
          <p className="text-[11px] text-[#6b7280] italic mb-1 truncate font-ui">
            &quot;{c.anchor_text.slice(0, 50)}{c.anchor_text.length > 50 ? '…' : ''}&quot;
          </p>
          <p className="text-[13px] text-[#000000] leading-[1.4] font-ui">{c.body}</p>
          <p className="text-[11px] text-[#9ca3af] mt-1.5 font-ui">
            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ))}
    </div>
  )
}
