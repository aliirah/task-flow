'use client'

import { useMemo, useState } from 'react'
import { BookOpen, CheckSquare, ChevronDown } from 'lucide-react'

import type {
  OrganizationMember,
  TaskPriority,
  TaskStatus,
  User,
} from '@/lib/types/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Tone = 'default' | 'info' | 'success' | 'warning' | 'danger'

type BadgeOption<TValue extends string> = {
  value: TValue
  label: string
  tone: Tone
  dotClass: string
}

const STATUS_OPTIONS: BadgeOption<TaskStatus>[] = [
  { value: 'open', label: 'Open', tone: 'info', dotClass: 'bg-sky-500' },
  { value: 'in_progress', label: 'In progress', tone: 'info', dotClass: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', tone: 'success', dotClass: 'bg-emerald-500' },
  { value: 'blocked', label: 'Blocked', tone: 'danger', dotClass: 'bg-rose-500' },
  { value: 'cancelled', label: 'Cancelled', tone: 'default', dotClass: 'bg-slate-400' },
]

const PRIORITY_OPTIONS: BadgeOption<TaskPriority>[] = [
  { value: 'low', label: 'Low', tone: 'default', dotClass: 'bg-slate-400' },
  { value: 'medium', label: 'Medium', tone: 'info', dotClass: 'bg-sky-500' },
  { value: 'high', label: 'High', tone: 'warning', dotClass: 'bg-amber-500' },
  { value: 'critical', label: 'Critical', tone: 'danger', dotClass: 'bg-rose-500' },
]

const TONE_STYLES: Record<Tone, string> = {
  default: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

type BadgeSelectProps<TValue extends string> = {
  value: TValue
  options: BadgeOption<TValue>[]
  onSelect: (value: TValue) => void
  disabled?: boolean
  ariaLabel?: string
}

function BadgeSelect<TValue extends string>({
  value,
  options,
  onSelect,
  disabled,
  ariaLabel,
}: BadgeSelectProps<TValue>) {
  const [open, setOpen] = useState(false)
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0]

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition',
            TONE_STYLES[selectedOption.tone],
            disabled && 'opacity-60'
          )}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <span className={cn('size-1.5 rounded-full', selectedOption.dotClass)} />
          {selectedOption.label}
          <ChevronDown className="size-3 text-current" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" sideOffset={6}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100',
              value === option.value && 'bg-slate-100 font-semibold text-slate-900'
            )}
            onClick={() => {
              onSelect(option.value)
              setOpen(false)
            }}
            disabled={value === option.value}
          >
            <span className={cn('size-1.5 rounded-full', option.dotClass)} />
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function StatusBadgeSelect({
  value,
  onSelect,
  disabled,
}: {
  value: TaskStatus
  onSelect: (value: TaskStatus) => void
  disabled?: boolean
}) {
  return (
    <BadgeSelect
      value={value}
      options={STATUS_OPTIONS}
      onSelect={onSelect}
      disabled={disabled}
      ariaLabel="Select status"
    />
  )
}

export function PriorityBadgeSelect({
  value,
  onSelect,
  disabled,
}: {
  value: TaskPriority
  onSelect: (value: TaskPriority) => void
  disabled?: boolean
}) {
  return (
    <BadgeSelect
      value={value}
      options={PRIORITY_OPTIONS}
      onSelect={onSelect}
      disabled={disabled}
      ariaLabel="Select priority"
    />
  )
}

export type AssigneeOption = {
  value: string
  label: string
  secondary?: string
  initials: string
  user?: User
}

const UNASSIGNED_OPTION: AssigneeOption = {
  value: '',
  label: 'Unassigned',
  secondary: 'No assignee yet',
  initials: 'UN',
}

const getUserInitials = (user?: User | null, fallback?: string) => {
  if (!user) return fallback ?? 'UN'
  const first = user.firstName?.[0] ?? ''
  const last = user.lastName?.[0] ?? ''
  const combined = `${first}${last}`.trim()
  if (combined) return combined.toUpperCase()
  if (user.email) return user.email.slice(0, 2).toUpperCase()
  return fallback ?? 'UN'
}

export const buildAssigneeOptions = (
  members: OrganizationMember[]
): AssigneeOption[] => {
  return members
    .filter((member) => Boolean(member.user))
    .map((member) => ({
      value: member.userId,
      label:
        `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() ||
        member.user?.email ||
        member.userId,
      secondary: member.user?.email ?? undefined,
      initials: getUserInitials(member.user, member.userId.slice(0, 2)),
      user: member.user ?? undefined,
    }))
}

export function AssigneeSearchSelect({
  value,
  options,
  onSelect,
  fallbackOption,
  disabled,
  loading,
}: {
  value: string
  options: AssigneeOption[]
  onSelect: (option: AssigneeOption) => void
  fallbackOption?: AssigneeOption
  disabled?: boolean
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const preparedOptions = useMemo(() => {
    const map = new Map<string, AssigneeOption>()
    options.forEach((option) => {
      map.set(option.value, option)
    })
    if (fallbackOption && !map.has(fallbackOption.value)) {
      map.set(fallbackOption.value, fallbackOption)
    }
    return [UNASSIGNED_OPTION, ...Array.from(map.values())]
  }, [options, fallbackOption])

  const filteredOptions = useMemo(() => {
    if (!query) return preparedOptions
    const q = query.toLowerCase()
    return preparedOptions.filter(
      (option) =>
        option.value === '' ||
        option.label.toLowerCase().includes(q) ||
        option.secondary?.toLowerCase().includes(q)
    )
  }, [preparedOptions, query])

  const selected =
    preparedOptions.find((option) => option.value === value) ?? UNASSIGNED_OPTION

  const handleSelect = (option: AssigneeOption) => {
    onSelect(option)
    setQuery('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300',
            disabled && 'opacity-60'
          )}
          disabled={disabled}
          aria-label="Select assignee"
        >
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              selected.value
                ? 'bg-slate-900/10 text-slate-800'
                : 'bg-slate-50 text-slate-500'
            )}
          >
            {selected.initials}
          </span>
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className="size-4 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end" sideOffset={6}>
        <div className="border-b border-slate-100 p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Loading members…</p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matches found.</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value || 'unassigned'}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm hover:bg-slate-100',
                  value === option.value && 'bg-slate-100 font-semibold text-slate-900'
                )}
                onClick={() => handleSelect(option)}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                    option.value
                      ? 'bg-slate-900/10 text-slate-800'
                      : 'bg-slate-50 text-slate-500'
                  )}
                >
                  {option.initials}
                </span>
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {option.secondary && (
                    <span className="text-[11px] text-slate-400">{option.secondary}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const TASK_TYPE_OPTIONS: {
  value: 'task' | 'story'
  label: string
  description: string
  icon: typeof CheckSquare
}[] = [
  {
    value: 'task',
    label: 'Task',
    description: 'Track actionable work items',
    icon: CheckSquare,
  },
  {
    value: 'story',
    label: 'Story',
    description: 'Group related work and sub-tasks',
    icon: BookOpen,
  },
]

export function TaskTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'task' | 'story' | 'sub-task'
  onChange: (value: 'task' | 'story' | 'sub-task') => void
  disabled?: boolean
}) {
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        {TASK_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-left shadow-sm transition',
                isSelected
                  ? 'border-slate-900 bg-slate-900/90 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon
                className={cn(
                  'mb-2 size-4',
                  isSelected ? 'text-white' : 'text-slate-500'
                )}
              />
              <div className="text-sm font-semibold">{option.label}</div>
              <p
                className={cn(
                  'text-xs',
                  isSelected ? 'text-white/70' : 'text-slate-500'
                )}
              >
                {option.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
