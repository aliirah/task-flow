'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'

import { Select } from '@/components/ui/select'
import { organizationApi, taskApi } from '@/lib/api'
import type { TaskPriority, TaskStatus, User } from '@/lib/types/api'
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

type AssigneeOption = {
  value: string
  label: string
  user?: User
}

type TaskAssigneeInlineSelectProps = {
  taskId: string
  value?: string
  options?: AssigneeOption[]
  organizationId?: string
  fallbackLabel?: string
  className?: string
  onUpdated?: (next: string | null, user?: User) => void
}

const memberCache = new Map<string, AssigneeOption[]>()

export function TaskAssigneeInlineSelect({
  taskId,
  value,
  options,
  organizationId,
  fallbackLabel,
  className,
  onUpdated,
}: TaskAssigneeInlineSelectProps) {
  const [selectOptions, setSelectOptions] = useState<AssigneeOption[]>(options ?? [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const currentValue = value ?? ''

  useEffect(() => {
    if (options) {
      setSelectOptions(options)
      return
    }
    if (!organizationId) {
      setSelectOptions([])
      return
    }
    if (memberCache.has(organizationId)) {
      setSelectOptions(memberCache.get(organizationId)!)
      return
    }
    let cancelled = false
    setLoading(true)
    organizationApi
      .listMembers(organizationId)
      .then((response) => {
        if (cancelled) return
        const mapped =
          response.data?.items?.map((member) => {
            const label =
              member.user
                ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() ||
                  member.user.email ||
                  member.userId
                : member.userId
            return {
              value: member.userId,
              label,
              user: member.user,
            }
          }) ?? []
        memberCache.set(organizationId, mapped)
        setSelectOptions(mapped)
      })
      .catch((error) => {
        if (!cancelled) {
          handleApiError({ error })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [options, organizationId])

  const allOptions = useMemo(() => {
    const base: AssigneeOption[] = [{ value: '', label: 'Unassigned' }]
    const hasCurrent =
      currentValue === '' ||
      selectOptions.some((opt) => opt.value === currentValue)
    const fallback = !hasCurrent && currentValue
      ? [
          {
            value: currentValue,
            label: fallbackLabel ?? currentValue,
          },
        ]
      : []
    return [...base, ...fallback, ...selectOptions]
  }, [selectOptions, currentValue, fallbackLabel])

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value || ''
    if (next === currentValue) return
    setSaving(true)
    try {
      await taskApi.update(taskId, {
        assigneeId: next || null,
      })
      const nextUser =
        next === ''
          ? undefined
          : selectOptions.find((opt) => opt.value === next)?.user
      onUpdated?.(next || null, nextUser)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select
        value={currentValue}
        onChange={handleChange}
        disabled={saving || loading}
        className={className}
      >
        {allOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
