'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, GripVertical, Trash2, Check, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { organizationApi, taskApi } from '@/lib/api'
import { OrganizationMember, Task, TaskPriority, TaskStatus, User } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Tone = 'default' | 'info' | 'success' | 'warning' | 'danger'

const TONE_STYLES: Record<Tone, string> = {
  default: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

type InlineOption<TValue extends string> = {
  value: TValue
  label: string
  tone: Tone
  dotClass: string
}

const STATUS_OPTIONS: InlineOption<TaskStatus>[] = [
  { value: 'open', label: 'Open', tone: 'info', dotClass: 'bg-sky-500' },
  { value: 'in_progress', label: 'In progress', tone: 'info', dotClass: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', tone: 'success', dotClass: 'bg-emerald-500' },
  { value: 'blocked', label: 'Blocked', tone: 'danger', dotClass: 'bg-rose-500' },
  { value: 'cancelled', label: 'Cancelled', tone: 'default', dotClass: 'bg-slate-400' },
]

const PRIORITY_OPTIONS: InlineOption<TaskPriority>[] = [
  { value: 'low', label: 'Low', tone: 'default', dotClass: 'bg-slate-400' },
  { value: 'medium', label: 'Medium', tone: 'info', dotClass: 'bg-sky-500' },
  { value: 'high', label: 'High', tone: 'warning', dotClass: 'bg-amber-500' },
  { value: 'critical', label: 'Critical', tone: 'danger', dotClass: 'bg-rose-500' },
]

type AssigneeOption = {
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

const describeUser = (user?: User | null, fallback?: string) => {
  if (!user) return fallback ?? ''
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || fallback || ''
}

const memberToOption = (member: OrganizationMember): AssigneeOption => ({
  value: member.userId,
  label:
    (member.user &&
      (`${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() ||
        member.user.email)) ||
    member.userId,
  secondary: member.user?.email,
  initials: getUserInitials(member.user, member.userId.slice(0, 2)),
  user: member.user ?? undefined,
})

interface SubTaskItemProps {
  task: Task
  onDelete: (id: string) => void
  isEditing: boolean
  editValue: string
  onEditValueChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  assigneeOptions: AssigneeOption[]
  assigneeLoading: boolean
  onUpdate: (taskId: string, updates: Partial<Task>, localPatch?: Partial<Task>) => Promise<void>
}

function SubTaskItem({
  task,
  onDelete,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  assigneeOptions,
  assigneeLoading,
  onUpdate,
}: SubTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const [pendingField, setPendingField] = useState<null | 'status' | 'priority' | 'assignee'>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const fallbackAssignee = useMemo(() => {
    if (!task.assigneeId) return undefined
    if (assigneeOptions.some((opt) => opt.value === task.assigneeId)) {
      return undefined
    }
    return {
      value: task.assigneeId,
      label: task.assignee
        ? describeUser(task.assignee, task.assigneeId)
        : task.assigneeId,
      secondary: task.assignee?.email,
      initials: getUserInitials(task.assignee, task.assigneeId.slice(0, 2)),
      user: task.assignee ?? undefined,
    }
  }, [task.assignee, task.assigneeId, assigneeOptions])

  const handleStatusSelect = async (next: TaskStatus) => {
    if (next === task.status || pendingField) return
    setPendingField('status')
    try {
      await onUpdate(task.id, { status: next })
    } finally {
      setPendingField(null)
    }
  }

  const handlePrioritySelect = async (next: TaskPriority) => {
    if (next === task.priority || pendingField) return
    setPendingField('priority')
    try {
      await onUpdate(task.id, { priority: next })
    } finally {
      setPendingField(null)
    }
  }

  const handleAssigneeSelect = async (option: AssigneeOption) => {
    if ((task.assigneeId ?? '') === option.value || pendingField) return
    setPendingField('assignee')
    try {
      await onUpdate(
        task.id,
        { assigneeId: option.value || undefined },
        {
          assigneeId: option.value || undefined,
          assignee: option.value ? option.user : undefined,
        }
      )
    } finally {
      setPendingField(null)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm transition hover:border-slate-300"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                autoFocus
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSaveEdit()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    onCancelEdit()
                  }
                }}
                className="h-8 text-sm"
                placeholder="Sub-task title"
              />
            ) : (
              <button
                onClick={onStartEdit}
                className="truncate text-left text-sm font-medium text-slate-900 hover:text-slate-700"
              >
                {task.title}
              </button>
            )}
            {isEditing && (
              <>
                <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-8 w-8 p-0">
                  <Check className="size-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-8 w-8 p-0">
                  <X className="size-4 text-slate-500" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(task.id)}
          className="h-8 w-8 p-0 text-rose-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <InlineMenu
          label="Status"
          value={task.status}
          options={STATUS_OPTIONS}
          onSelect={(value) => handleStatusSelect(value as TaskStatus)}
          disabled={pendingField === 'status'}
        />
        <InlineMenu
          label="Priority"
          value={task.priority}
          options={PRIORITY_OPTIONS}
          onSelect={(value) => handlePrioritySelect(value as TaskPriority)}
          disabled={pendingField === 'priority'}
        />
        <AssigneeSelect
          value={task.assigneeId ?? ''}
          options={assigneeOptions}
          fallbackOption={fallbackAssignee}
          onSelect={handleAssigneeSelect}
          disabled={pendingField === 'assignee'}
          loading={assigneeLoading}
        />
        {task.createdAt && (
          <span className="ml-auto text-[11px] text-slate-400">
            Created {new Date(task.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

interface StorySubTasksProps {
  storyId: string
  organizationId: string
}

export function StorySubTasks({ storyId, organizationId }: StorySubTasksProps) {
  const [subTasks, setSubTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([])
  const [assigneeLoading, setAssigneeLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadSubTasks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await taskApi.list({
        organizationId,
        sortBy: 'displayOrder',
        sortOrder: 'asc',
      })
      const allTasks = response.data?.items ?? []
      const filtered = allTasks.filter((t) => t.parentTaskId === storyId)
      setSubTasks(filtered)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoading(false)
    }
  }, [storyId, organizationId])

  useEffect(() => {
    loadSubTasks()
  }, [loadSubTasks])

  useEffect(() => {
    let cancelled = false
    setAssigneeLoading(true)
    organizationApi
      .listMembers(organizationId)
      .then((response) => {
        if (cancelled) return
        const mapped =
          response.data?.items?.map((member) => memberToOption(member)) ?? []
        setAssigneeOptions(mapped)
      })
      .catch((error) => {
        if (!cancelled) {
          handleApiError({ error })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssigneeLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const handleInlineUpdate = useCallback(
    async (taskId: string, updates: Partial<Task>, localPatch: Partial<Task> = {}) => {
      try {
        await taskApi.update(taskId, updates)
        setSubTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, ...updates, ...localPatch } : task
          )
        )
      } catch (error) {
        handleApiError({ error })
      }
    },
    []
  )

  const handleCreate = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a title')
      return
    }

    setCreating(true)
    try {
      const payload = {
        title: newTaskTitle.trim(),
        organizationId,
        parentTaskId: storyId,
        type: 'sub-task',
        status: 'open',
        priority: 'medium',
        displayOrder: subTasks.length,
      }
      const response = await taskApi.create(payload)
      setSubTasks((prev) => [...prev, response.data])
      setNewTaskTitle('')
      toast.success('Sub-task created')
    } catch (error) {
      handleApiError({ error })
    } finally {
      setCreating(false)
    }
  }

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id)
    setEditValue(task.title)
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditValue('')
  }

  const handleSaveEdit = async () => {
    if (!editingTaskId || !editValue.trim()) {
      toast.error('Please enter a title')
      return
    }

    try {
      await taskApi.update(editingTaskId, {
        title: editValue.trim(),
      })
      setSubTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId ? { ...t, title: editValue.trim() } : t
        )
      )
      setEditingTaskId(null)
      setEditValue('')
      toast.success('Sub-task updated')
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sub-task?')) return

    try {
      await taskApi.remove(id)
      setSubTasks((prev) => prev.filter((t) => t.id !== id))
      toast.success('Sub-task deleted')
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = subTasks.findIndex((t) => t.id === active.id)
    const newIndex = subTasks.findIndex((t) => t.id === over.id)

    const reordered = arrayMove(subTasks, oldIndex, newIndex)
    setSubTasks(reordered)

    const updates = reordered.map((task, index) => ({
      id: task.id,
      displayOrder: index,
    }))

    try {
      await taskApi.reorder({
        organizationId,
        tasks: updates,
      })
      toast.success('Sub-tasks reordered')
    } catch (error) {
      handleApiError({ error })
      setSubTasks(subTasks)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Loading sub-tasks...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Sub-tasks ({subTasks.length})
        </h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={subTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {subTasks.map((task) => (
              <SubTaskItem
                key={task.id}
                task={task}
                onDelete={handleDelete}
                isEditing={editingTaskId === task.id}
                editValue={editingTaskId === task.id ? editValue : ''}
                onEditValueChange={setEditValue}
                onStartEdit={() => handleStartEdit(task)}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                assigneeOptions={assigneeOptions}
                assigneeLoading={assigneeLoading}
                onUpdate={handleInlineUpdate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {subTasks.length === 0 && (
        <p className="mb-4 mt-2 text-sm text-slate-500">
          No sub-tasks yet. Add one below.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
          placeholder="Add a sub-task..."
          className="flex-1 text-sm"
          disabled={creating}
        />
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !newTaskTitle.trim()}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}

type InlineMenuProps<TValue extends string> = {
  label: string
  value: TValue
  options: InlineOption<TValue>[]
  onSelect: (value: TValue) => void
  disabled?: boolean
}

function InlineMenu<TValue extends string>({
  label,
  value,
  options,
  onSelect,
  disabled,
}: InlineMenuProps<TValue>) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition',
            TONE_STYLES[selected.tone],
            disabled && 'opacity-60'
          )}
          disabled={disabled}
          aria-label={label}
        >
          <span className={cn('size-1.5 rounded-full', selected.dotClass)} />
          {selected.label}
          <ChevronDown className="size-3 text-current" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" sideOffset={6}>
        <div className="text-[11px] uppercase tracking-wide text-slate-400 px-2 py-1">
          {label}
        </div>
        {options.map((option) => (
          <button
            key={option.value}
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

type AssigneeSelectProps = {
  value: string
  options: AssigneeOption[]
  fallbackOption?: AssigneeOption
  onSelect: (option: AssigneeOption) => void
  disabled?: boolean
  loading?: boolean
}

function AssigneeSelect({
  value,
  options,
  fallbackOption,
  onSelect,
  disabled,
  loading,
}: AssigneeSelectProps) {
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
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300',
            disabled && 'opacity-60'
          )}
          disabled={disabled}
          aria-label="Assign user"
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
              selected.value
                ? 'bg-slate-900/10 text-slate-800'
                : 'bg-slate-50 text-slate-500'
            )}
          >
            {selected.initials}
          </span>
          <span className="max-w-[120px] truncate">{selected.label}</span>
          <ChevronDown className="size-3 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={6}>
        <div className="border-b border-slate-100 p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Loading members…</p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matches found.</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value || 'unassigned'}
                className={cn(
                  'flex w-full items-center gap-3 rounded px-2 py-2 text-left text-xs hover:bg-slate-100',
                  value === option.value && 'bg-slate-100 font-semibold text-slate-900'
                )}
                onClick={() => handleSelect(option)}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold',
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
