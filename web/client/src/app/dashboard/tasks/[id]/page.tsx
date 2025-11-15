'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { BookOpen, CheckSquare, ChevronLeft, ChevronRight, ListTodo, SidebarClose, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { organizationApi, taskApi } from '@/lib/api'
import { OrganizationMember, Task, TaskPriority, TaskStatus, User } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { CommentList } from '@/components/comments/comment-list'
import { StorySubTasks } from '@/components/tasks/story-subtasks'
import { useAuthStore } from '@/store/auth'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import type { TaskEventMessage } from '@/lib/types/ws'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DateTimePickerField } from '@/components/ui/date-time-picker'

const schema = z.object({
  organizationId: z.string().uuid('Select an organization'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(4096).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'completed', 'blocked', 'cancelled']),
  type: z.enum(['task', 'story', 'sub-task']),
  dueAt: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const STATUS_BADGES: Record<
  TaskStatus,
  { label: string; tone: 'default' | 'info' | 'success' | 'warning' | 'danger' }
> = {
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  blocked: { label: 'Blocked', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'default' },
}

const PRIORITY_LABELS: Record<
  TaskPriority,
  { label: string; tone: 'default' | 'info' | 'warning' | 'danger' }
> = {
  low: { label: 'Low', tone: 'default' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
}

const TYPE_LABELS: Record<
  'task' | 'story' | 'sub-task',
  { label: string; tone: 'default' | 'info' | 'success' }
> = {
  task: { label: 'Task', tone: 'default' },
  story: { label: 'Story', tone: 'info' },
  'sub-task': { label: 'Sub-task', tone: 'success' },
}

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const taskId = params?.id
  const { organizations: dashboardOrgs } = useDashboard()
  const currentUserId = useAuthStore((state) => state.user?.id)

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true) // Start collapsed on mobile
  const [hydrated, setHydrated] = useState(false)
  const [editingField, setEditingField] = useState({
    title: false,
    description: false,
    organization: false,
    status: false,
    priority: false,
    type: false,
    dueAt: false,
    assignee: false,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: '',
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      type: 'task',
      dueAt: '',
    },
  })

  const organizationId = useWatch({
    control: form.control,
    name: 'organizationId',
  })

  const organizationOptions = useMemo(() => {
    if (task?.organization && !dashboardOrgs.some((org) => org.id === task.organization!.id)) {
      return [...dashboardOrgs, task.organization]
    }
    return dashboardOrgs
  }, [dashboardOrgs, task?.organization])

  // Load sidebar state from localStorage
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024 // lg breakpoint
    
    if (isDesktop) {
      const stored = localStorage.getItem('task-detail:sidebar-collapsed')
      if (stored !== null) {
        setSidebarCollapsed(stored === 'true')
      } else {
        setSidebarCollapsed(false) // Desktop default: open
      }
    } else {
      setSidebarCollapsed(true) // Mobile default: collapsed
    }
    setHydrated(true)
  }, [])

  // Save sidebar state to localStorage
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('task-detail:sidebar-collapsed', String(sidebarCollapsed))
    }
  }, [sidebarCollapsed, hydrated])

  useEffect(() => {
    if (!taskId || taskId === 'new') {
      setTask(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const fetchTask = async () => {
      setLoading(true)
      try {
        const response = await taskApi.get(taskId)
        if (cancelled) return
        const current = response.data
        setTask(current ?? null)
        if (current) {
          form.reset({
            organizationId: current.organizationId,
            title: current.title,
            description: current.description ?? '',
            assigneeId: current.assigneeId ?? '',
            priority: current.priority as TaskPriority,
            status: current.status as TaskStatus,
            type: (current.type as 'task' | 'story' | 'sub-task') || 'task',
            dueAt: current.dueAt ?? '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          handleApiError({ error })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchTask()
    return () => {
      cancelled = true
    }
  }, [taskId, form])

  useEffect(() => {
    if (!organizationId) {
      setMembers([])
      return
    }
    let cancelled = false
    const loadMembers = async () => {
      try {
        const response = await organizationApi.listMembers(organizationId)
        if (!cancelled) {
          setMembers(response.data?.items ?? [])
        }
      } catch (error) {
        if (!cancelled) {
          handleApiError({ error })
        }
      }
    }
    loadMembers()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  // Load users for mentions
  useEffect(() => {
    if (members.length === 0) {
      setUsers([])
      return
    }
    const uniqueUsers = members
      .filter((m) => m.user)
      .map((m) => m.user!)
      .filter((user, index, self) => self.findIndex((u) => u.id === user.id) === index)
    setUsers(uniqueUsers)
  }, [members])

  // Listen for WebSocket task updates
  useTaskEvents(
    useCallback(
      (event: TaskEventMessage) => {
        // Only update if this is the task we're viewing
        if (event.data.taskId !== taskId) return
        
        console.log('[TaskDetail] Received task update via WebSocket:', event)
        
        // Prepare the updated task data
        const newFormData = {
          organizationId: event.data.organizationId,
          title: event.data.title,
          description: event.data.description ?? '',
          assigneeId: event.data.assigneeId ?? '',
          priority: event.data.priority as TaskPriority,
          status: event.data.status as TaskStatus,
          type: (event.data.type as 'task' | 'story' | 'sub-task') || 'task',
          dueAt: event.data.dueAt ?? '',
        }
        
        // Always update the form with the latest data from other users
        // This ensures the UI reflects the current state
        console.log('[TaskDetail] Resetting form with new data:', newFormData)
        form.reset(newFormData)
        
        // Update task state with the latest data from WebSocket
        setTask((prev) => {
          if (!prev) return prev
          
          return {
            ...prev,
            id: event.data.taskId,
            organizationId: event.data.organizationId,
            title: event.data.title,
            description: event.data.description,
            status: event.data.status,
            priority: event.data.priority,
            reporterId: event.data.reporterId,
            assigneeId: event.data.assigneeId,
            dueAt: event.data.dueAt,
            updatedAt: event.data.updatedAt,
            // Preserve nested objects if not in event data
            organization: event.data.organization ?? prev.organization,
            assignee: event.data.assignee ?? prev.assignee,
            reporter: event.data.reporter ?? prev.reporter,
          }
        })
      },
      [taskId, form]
    )
  )

  const handleAutoSave = async () => {
    if (!taskId || saving) return
    const isDirty = Object.keys(form.formState.dirtyFields).length > 0
    if (!isDirty) return

    const values = form.getValues()
    setSaving(true)
    try {
      await taskApi.update(taskId, {
        organizationId: values.organizationId,
        title: values.title,
        description: values.description ?? '',
        assigneeId: values.assigneeId || null,
        priority: values.priority,
        status: values.status,
        type: values.type,
        dueAt: values.dueAt || null,
      })

      setTask((prev) => {
        if (!prev) return prev
        const nextOrg =
          organizationOptions.find((org) => org.id === values.organizationId) ??
          prev.organization
        const nextAssignee =
          members.find((member) => member.userId === values.assigneeId)?.user ??
          prev.assignee
        return {
          ...prev,
          ...values,
          organization: nextOrg ?? prev.organization,
          assignee: nextAssignee ?? undefined,
          assigneeId: values.assigneeId || undefined,
          dueAt: values.dueAt || undefined,
        }
      })
      form.reset(values)
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldBlur = () => {
    void handleAutoSave()
  }

  const handleSelectChange = (name: keyof FormValues, value: string) => {
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true })
    void handleAutoSave()
  }

  const handleDueAtChange = (value?: string) => {
    form.setValue('dueAt', value ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    })
    void handleAutoSave()
    setEditingField((prev) => ({ ...prev, dueAt: false }))
  }

  const handleDelete = async () => {
    if (!taskId) return
    try {
      setDeleteLoading(true)
      await taskApi.remove(taskId)
      toast.success('Task deleted')
      router.push(
        `/dashboard/tasks${
          form.getValues('organizationId')
            ? `?orgId=${form.getValues('organizationId')}`
            : ''
        }`
      )
      router.refresh()
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleteLoading(false)
      setDeleteOpen(false)
    }
  }

  const titleValue = form.watch('title')
  const descriptionValue = form.watch('description')
  const watchedStatus = (form.watch('status') as TaskStatus) || 'open'
  const watchedPriority = (form.watch('priority') as TaskPriority) || 'medium'
  const watchedType = (form.watch('type') as 'task' | 'story' | 'sub-task') || 'task'
  const dueAtValue = form.watch('dueAt')
  const assigneeIdValue = form.watch('assigneeId') ?? ''
  const assigneeInMembers = assigneeIdValue
    ? members.some((member) => member.userId === assigneeIdValue)
    : true
  const reporterName = task?.reporter
    ? `${task.reporter.firstName ?? ''} ${task.reporter.lastName ?? ''}`.trim() ||
      task.reporter.email ||
      task.reporterId
    : task?.reporterId || '—'
  const reporterEmail = task?.reporter?.email
  const statusDisplay = STATUS_BADGES[watchedStatus].label
  const priorityDisplay = PRIORITY_LABELS[watchedPriority].label
  const typeDisplay = TYPE_LABELS[watchedType].label
  const dueDateDisplay = dueAtValue
    ? new Date(dueAtValue).toLocaleString()
    : 'No due date'
  const selectedAssigneeMember = members.find(
    (member) => member.userId === assigneeIdValue
  )
  const fallbackAssigneeUser = selectedAssigneeMember?.user ?? task?.assignee
  const assigneeDisplay = assigneeIdValue
    ? fallbackAssigneeUser
      ? `${fallbackAssigneeUser.firstName ?? ''} ${
          fallbackAssigneeUser.lastName ?? ''
        }`.trim() || fallbackAssigneeUser.email || assigneeIdValue
      : assigneeIdValue
    : 'Unassigned'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-8 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600 transition-colors hover:bg-slate-900/20"
              >
                {watchedType === 'story' && <BookOpen className="size-4" />}
                {watchedType === 'task' && <CheckSquare className="size-4" />}
                {watchedType === 'sub-task' && <ListTodo className="size-4" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => handleSelectChange('type', 'task')}
                >
                  <CheckSquare className="size-4 text-slate-600" />
                  <span className="flex-1 text-left">Task</span>
                  {watchedType === 'task' && (
                    <div className="size-1.5 rounded-full bg-slate-900" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => handleSelectChange('type', 'story')}
                >
                  <BookOpen className="size-4 text-slate-600" />
                  <span className="flex-1 text-left">Story</span>
                  {watchedType === 'story' && (
                    <div className="size-1.5 rounded-full bg-slate-900" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => handleSelectChange('type', 'sub-task')}
                >
                  <ListTodo className="size-4 text-slate-600" />
                  <span className="flex-1 text-left">Sub-task</span>
                  {watchedType === 'sub-task' && (
                    <div className="size-1.5 rounded-full bg-slate-900" />
                  )}
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex flex-col">
            <Controller
              control={form.control}
              name="title"
              render={({ field }) =>
                editingField.title ? (
                  <Input
                    {...field}
                    autoFocus
                    value={field.value}
                    placeholder="Untitled task"
                    className="border border-slate-300 bg-white px-3 py-2 text-2xl font-semibold"
                    onBlur={() => {
                      field.onBlur()
                      setEditingField((prev) => ({ ...prev, title: false }))
                      handleFieldBlur()
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="text-left text-2xl font-semibold text-slate-900 hover:text-slate-700"
                    onClick={() =>
                      setEditingField((prev) => ({ ...prev, title: true }))
                    }
                  >
                    {field.value || 'Untitled task'}
                  </button>
                )
              }
            />
            <p className="text-sm text-slate-500">
              {saving ? 'Saving…' : 'Updates save automatically.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setDeleteOpen(true)}
            disabled={loading || !task}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Task details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Click any field to edit. Changes save on blur automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading task…</p>
          ) : !task ? (
            <p className="text-sm text-rose-500">Task not found.</p>
          ) : (
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
              <div className="space-y-6 lg:min-w-0">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Description
                  </label>
                  {editingField.description ? (
                    <Textarea
                      autoFocus
                      value={descriptionValue}
                      placeholder="Add more context…"
                      className="min-h-[140px]"
                      onChange={(event) =>
                        form.setValue('description', event.target.value, {
                          shouldDirty: true,
                        })
                      }
                      onBlur={() => {
                        setEditingField((prev) => ({ ...prev, description: false }))
                        handleFieldBlur()
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex min-h-[140px] w-full flex-col items-start rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-200"
                      onClick={() =>
                        setEditingField((prev) => ({ ...prev, description: true }))
                      }
                    >
                      <span className="whitespace-pre-wrap">
                        {descriptionValue?.trim()
                          ? descriptionValue
                          : 'Add a description…'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Sub-tasks Section (only for stories) */}
                {watchedType === 'story' && taskId && organizationId && (
                  <StorySubTasks
                    storyId={taskId}
                    organizationId={organizationId}
                  />
                )}

                {/* Comments Section */}
                {currentUserId && taskId && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Comments</h3>
                    <CommentList
                      taskId={taskId}
                      currentUserId={currentUserId}
                      users={users}
                    />
                  </div>
                )}
              </div>
              

              
              {/* Collapsible Sidebar */}
              <div className={`lg:relative lg:flex lg:flex-col ${sidebarCollapsed ? 'lg:w-0' : 'lg:w-72'} transition-all duration-300 ease-in-out`}>
                {/* Toggle Button - Desktop */}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:flex absolute -left-3 top-0 z-10 size-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                  aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
                >
                  {sidebarCollapsed ? (
                    <ChevronLeft className="size-4 text-slate-600" />
                  ) : (
                    <ChevronRight className="size-4 text-slate-600" />
                  )}
                </button>

                {/* Sidebar Content */}
                <div
                  className={`
                    fixed lg:relative
                    inset-y-0 right-0 lg:inset-auto
                    z-50 lg:z-auto
                    w-80 lg:w-full
                    h-full lg:h-auto
                    overflow-y-auto lg:overflow-visible
                    bg-white border-l border-slate-200 shadow-xl lg:bg-transparent lg:border-0 lg:shadow-none
                    p-4 lg:p-0
                    space-y-2.5 text-sm
                    transition-transform duration-300 ease-in-out lg:transition-none
                    ${sidebarCollapsed ? 'translate-x-full pointer-events-none opacity-0' : 'translate-x-0 opacity-100 pointer-events-auto'}
                    ${sidebarCollapsed ? 'lg:hidden' : 'lg:block'}
                  `}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Workflow
                      </p>
                      {/* Toggle Button - Mobile */}
                      <button
                        type="button"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="lg:hidden -mr-1 flex items-center justify-center p-1 rounded hover:bg-slate-100"
                        aria-label="Close sidebar"
                      >
                        <SidebarClose className="size-4 text-slate-400" />
                      </button>
                    </div>
                  <div className="mt-2.5 space-y-3">
                    <div>
                      <p className="text-xs uppercase text-slate-400">Status</p>
                      {editingField.status ? (
                        <Select
                          autoFocus
                          value={form.watch('status')}
                          onChange={(event) => {
                            handleSelectChange('status', event.target.value)
                            setEditingField((prev) => ({ ...prev, status: false }))
                          }}
                          onBlur={() =>
                            setEditingField((prev) => ({ ...prev, status: false }))
                          }
                        >
                          {(Object.keys(STATUS_BADGES) as TaskStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_BADGES[status].label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-800"
                          onClick={() =>
                            setEditingField((prev) => ({ ...prev, status: true }))
                          }
                        >
                          <Badge tone={STATUS_BADGES[watchedStatus].tone}>
                            {statusDisplay}
                          </Badge>
                          <span className="text-slate-500">Change</span>
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400">Priority</p>
                      {editingField.priority ? (
                        <Select
                          autoFocus
                          value={form.watch('priority')}
                          onChange={(event) => {
                            handleSelectChange('priority', event.target.value)
                            setEditingField((prev) => ({ ...prev, priority: false }))
                          }}
                          onBlur={() =>
                            setEditingField((prev) => ({ ...prev, priority: false }))
                          }
                        >
                          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(
                            (priority) => (
                              <option key={priority} value={priority}>
                                {PRIORITY_LABELS[priority].label}
                              </option>
                            )
                          )}
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-800"
                          onClick={() =>
                            setEditingField((prev) => ({ ...prev, priority: true }))
                          }
                        >
                          <Badge tone={PRIORITY_LABELS[watchedPriority].tone}>
                            {priorityDisplay}
                          </Badge>
                          <span className="text-slate-500">Change</span>
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400">Due date</p>
                      {editingField.dueAt ? (
                        <div className="space-y-2">
                          <DateTimePickerField
                            value={form.watch('dueAt') ?? undefined}
                            onChange={handleDueAtChange}
                            label=""
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditingField((prev) => ({ ...prev, dueAt: false }))
                              }
                            >
                              Done
                            </Button>
                            {dueAtValue && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDueAtChange(undefined)}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800"
                          onClick={() =>
                            setEditingField((prev) => ({ ...prev, dueAt: true }))
                          }
                        >
                          {dueDateDisplay}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-2.5 text-sm shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    People
                  </p>
                  <div className="mt-3 space-y-4 text-sm">
                    <div>
                      <p className="text-xs uppercase text-slate-400">Reporter</p>
                      <p className="text-sm font-medium text-slate-900">
                        {reporterName}
                      </p>
                      {reporterEmail && (
                        <p className="text-xs text-slate-500">{reporterEmail}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs uppercase text-slate-400">
                        Assignee
                      </label>
                      {editingField.assignee ? (
                        <Select
                          autoFocus
                          value={assigneeIdValue}
                          onChange={(event) => {
                            handleSelectChange('assigneeId', event.target.value)
                            setEditingField((prev) => ({ ...prev, assignee: false }))
                          }}
                          onBlur={() =>
                            setEditingField((prev) => ({ ...prev, assignee: false }))
                          }
                        >
                        <option value="">Unassigned</option>
                        {!assigneeInMembers && assigneeIdValue && (
                          <option value={assigneeIdValue}>
                            {fallbackAssigneeUser
                              ? `${fallbackAssigneeUser.firstName ?? ''} ${
                                  fallbackAssigneeUser.lastName ?? ''
                                }`.trim() || fallbackAssigneeUser.email || assigneeIdValue
                              : assigneeIdValue}
                          </option>
                        )}
                          {members.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.user
                                ? `${member.user.firstName ?? ''} ${
                                    member.user.lastName ?? ''
                                  }`.trim() || member.user.email
                                : member.userId}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800"
                          onClick={() =>
                            setEditingField((prev) => ({ ...prev, assignee: true }))
                          }
                        >
                          {assigneeDisplay}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm sm:text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Activity
                  </p>
                  <dl className="mt-3 space-y-3 text-sm text-slate-600">
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Created</dt>
                      <dd>
                        {task.createdAt
                          ? new Date(task.createdAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Updated</dt>
                      <dd>
                        {task.updatedAt
                          ? new Date(task.updatedAt).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Task ID</dt>
                      <dd className="break-all font-mono text-xs text-slate-500">
                        {task.id}
                      </dd>
                    </div>
                  </dl>
                </div>
                </div>
              </div>
              
              {/* Floating toggle button when sidebar is collapsed on mobile */}
              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="lg:hidden fixed top-4 right-4 z-50 flex size-10 items-center justify-center rounded-full border border-slate-300 bg-white shadow-lg hover:bg-slate-50 active:scale-95 transition-transform"
                  aria-label="Open sidebar"
                >
                  <SidebarClose className="size-6 text-slate-600" />
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => (deleteLoading ? null : setDeleteOpen(false))}
        title="Delete task"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Remove <strong>{titleValue || 'this task'}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
