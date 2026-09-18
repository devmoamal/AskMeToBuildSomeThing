import React from 'react'
import { cn } from '../../lib/utils'



interface VercelKbdProps {
  children: React.ReactNode
  className?: string
}

/**
 * Vercel Geist Keyboard keycap primitive
 */
export const VercelKbd: React.FC<VercelKbdProps> = ({ children, className }) => (
  <kbd
    className={cn(
      'inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded',
      'border border-white/15 bg-white/[0.06] text-zinc-400 shadow-[0_1px_0_rgba(255,255,255,0.08)] leading-none',
      className
    )}
  >
    {children}
  </kbd>
)

interface VercelBadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'blue'
}

/**
 * Vercel Geist Metric / Status badge primitive
 */
export const VercelBadge: React.FC<VercelBadgeProps> = ({
  children,
  className,
  variant = 'default'
}) => {
  const variantStyles = {
    default: 'border-[#222] bg-[#111] text-zinc-400',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    blue: 'border-[#0070f3]/30 bg-[#0070f3]/10 text-[#0070f3]'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export const GeistKbd = VercelKbd
export const GeistBadge = VercelBadge
