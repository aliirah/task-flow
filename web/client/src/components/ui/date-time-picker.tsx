'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface DateTimePickerProps {
  value?: string
  onChange: (value: string | undefined) => void
  disabled?: boolean
  className?: string
}

export function DateTimePickerField({
  value,
  onChange,
  disabled,
  className,
}: DateTimePickerProps) {
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('')

  useEffect(() => {
    if (!value) {
      setDateValue('')
      setTimeValue('')
      return
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      setDateValue('')
      setTimeValue('')
      return
    }
    setDateValue(date.toISOString().slice(0, 10))
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    setTimeValue(`${hours}:${minutes}`)
  }, [value])

  const emit = (nextDate?: string, nextTime?: string) => {
    if (!nextDate || !nextTime) {
      onChange(undefined)
      return
    }
    const iso = new Date(`${nextDate}T${nextTime}`)
    if (Number.isNaN(iso.getTime())) {
      onChange(undefined)
      return
    }
    onChange(iso.toISOString())
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3',
        disabled && 'opacity-60',
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Date
        </span>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="mr-2 text-slate-400">📅</span>
          <Input
            type="date"
            value={dateValue}
            onChange={(event) => {
              const next = event.target.value
              setDateValue(next)
              emit(next, timeValue)
            }}
            disabled={disabled}
            className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Time
        </span>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="mr-2 text-slate-400">⏰</span>
          <Input
            type="time"
            value={timeValue}
            onChange={(event) => {
              const next = event.target.value
              setTimeValue(next)
              emit(dateValue, next)
            }}
            disabled={disabled}
            className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
          />
        </div>
      </div>
    </div>
  )
}
