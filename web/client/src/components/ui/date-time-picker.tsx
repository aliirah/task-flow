'use client'

import { useEffect, useState } from 'react'
import { DatePicker } from 'rsuite'
import 'rsuite/DatePicker/styles/index.css'

import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value?: string
  onChange: (value: string | undefined) => void
  disabled?: boolean
  className?: string
  label?: string
}

export function DateTimePickerField({
  value,
  onChange,
  disabled,
  className,
  label = 'Due date',
}: DateTimePickerProps) {
  const [selected, setSelected] = useState<Date | null>(null)

  useEffect(() => {
    if (!value) {
      setSelected(null)
      return
    }
    const parsed = new Date(value)
    setSelected(Number.isNaN(parsed.getTime()) ? null : parsed)
  }, [value])

  const formatRFC3339 = (date: Date) => {
    const iso = date.toISOString()
    return iso.replace(/\.\d{3}Z$/, 'Z')
  }

  const handleChange = (nextValue: Date | null) => {
    setSelected(nextValue)
    if (!nextValue) {
      onChange(undefined)
      return
    }
    onChange(formatRFC3339(nextValue))
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <DatePicker
        value={selected ?? undefined}
        onChange={handleChange}
        format="yyyy-MM-dd HH:mm"
        placement="bottomStart"
        showMeridian={false}
        ranges={[]}
        className="rsuite-date-picker"
        menuStyle={{ zIndex: 3000 }}
        style={{ width: '100%' }}
        disabled={disabled}
      />
    </div>
  )
}
