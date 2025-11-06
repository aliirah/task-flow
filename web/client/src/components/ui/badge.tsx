'use client'

import { cn } from '@/lib/utils'

const toneMap: Record<
  'default' | 'success' | 'warning' | 'danger' | 'info',
  string
> = {
  default: 'bg-slate-900/10 text-slate-700',
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-rose-500/10 text-rose-600',
  info: 'bg-sky-500/10 text-sky-600',
}

type BadgeProps = {
  tone?: keyof typeof toneMap
  className?: string
  children: React.ReactNode
}

export function Badge({ tone = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        toneMap[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
