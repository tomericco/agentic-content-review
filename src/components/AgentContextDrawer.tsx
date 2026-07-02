'use client'

import { useEffect, useState } from 'react'
import Button from './Button'

interface Props {
  context: string
  onClose: () => void
}

export default function AgentContextDrawer({ context, onClose }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/40 z-30">
      <div
        className={`absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl p-6 flex flex-col gap-3 overflow-y-auto transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 font-ui">Agent context</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <p className="text-[14px] text-[#6b7280] font-ui leading-[1.5] whitespace-pre-wrap">
          {context}
        </p>
      </div>
    </div>
  )
}
