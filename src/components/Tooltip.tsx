'use client'

import { useState, useRef } from 'react'

interface Props {
  content: string
  children: React.ReactNode
  delay?: number
  className?: string
}

export default function Tooltip({ content, children, delay = 750, className }: Props) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  return (
    <span
      className={`relative cursor-default${className ? ` ${className}` : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <span
        className={`pointer-events-none absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded bg-[#111] px-2 py-1 text-[11px] text-white z-50 transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {content}
      </span>
    </span>
  )
}
