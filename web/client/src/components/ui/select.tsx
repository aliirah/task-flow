'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  containerClassName?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, ...props }, ref) => (
    <div className={cn('relative inline-flex w-full items-center', containerClassName)}>
      <select
        ref={ref}
        className={cn(
          'flex w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
)

Select.displayName = 'Select'
