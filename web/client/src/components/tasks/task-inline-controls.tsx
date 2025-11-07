'use client'

import { ChangeEvent, useState } from 'react'

import { Select } from '@/components/ui/select'
import { taskApi } from '@/lib/api'
import type { TaskPriority, TaskStatus } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'

type BaseProps<T> = {
  taskId: string
  value: T
  onUpdated?: (next: T) => void
  className?: string
}

export function TaskStatusInlineSelect({
  taskId,
  value,
  onUpdated,
  className,
}: BaseProps<TaskStatus>) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as TaskStatus
    if (next === value) return
    setSaving(true)
    try {
      await taskApi.update(taskId, { status: next })
      onUpdated?.(next)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select
        value={value}
        onChange={handleChange}
        disabled={saving}
        className={className}
      >
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="blocked">Blocked</option>
        <option value="cancelled">Cancelled</option>
      </Select>
    </div>
  )
}

export function TaskPriorityInlineSelect({
  taskId,
  value,
  onUpdated,
  className,
}: BaseProps<TaskPriority>) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as TaskPriority
    if (next === value) return
    setSaving(true)
    try {
      await taskApi.update(taskId, { priority: next })
      onUpdated?.(next)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select
        value={value}
        onChange={handleChange}
        disabled={saving}
        className={className}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </Select>
    </div>
  )
}
