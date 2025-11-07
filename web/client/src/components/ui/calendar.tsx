'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'

import 'react-day-picker/dist/style.css'

type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption:
          'flex justify-center pt-1 relative items-center text-sm font-medium text-slate-700',
        nav: 'space-x-1 flex items-center',
        nav_button:
          'inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell:
          'text-slate-400 rounded-md w-10 font-medium text-[0.7rem] uppercase',
        row: 'flex w-full mt-2',
        cell: 'relative p-0 text-center text-sm',
        day: cn(
          'h-10 w-10 rounded-lg border border-transparent p-0 font-medium transition-all',
          'hover:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'
        ),
        day_selected:
          'bg-slate-900 text-white hover:bg-slate-900 hover:text-white',
        day_today: 'bg-slate-100 text-slate-900',
        day_outside: 'text-slate-300 opacity-50',
        day_disabled: 'text-slate-300 opacity-50',
        ...classNames,
      }}
      {...props}
    />
  )
}
