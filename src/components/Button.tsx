'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-[#000000] text-white hover:bg-[#1f2937] font-semibold',
  secondary: 'border border-[#e5e7eb] text-[#374151] hover:bg-gray-50',
  accent:    'bg-amber-500 text-white hover:bg-amber-600',
  ghost:     'text-[#6b7280] hover:text-[#000000]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1',
  md: 'px-4 py-1.5',
  lg: 'px-4 py-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: Props) {
  const isGhost = variant === 'ghost'
  return (
    <button
      className={[
        'inline-flex items-center justify-center',
        'text-sm font-medium rounded-md transition-colors font-ui cursor-pointer',
        'disabled:opacity-40',
        isGhost ? '' : sizeClasses[size],
        variantClasses[variant],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
