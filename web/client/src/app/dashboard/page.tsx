'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Activity,
  CalendarDays,
  CheckSquare,
  Clock4,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { UserEmailSelect } from '@/components/organizations/user-email-select'
import {
  organizationApi,
  taskApi,
} from '@/lib/api'
import { handleApiError } from '@/lib/utils/error-handler'
import type {
  Organization,
  OrganizationMember,
  Task,
  TaskStatus,
  User,
} from '@/lib/types/api'
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
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { DateTimePickerField } from '@/components/ui/date-time-picker'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import type { TaskEventMessage } from '@/lib/types/ws'
import {
  TaskAssigneeInlineSelect,
  TaskPriorityInlineSelect,
  TaskStatusInlineSelect,
} from '@/components/tasks/task-inline-controls'

const organizationFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(128),
  description: z
    .string()
    .max(1024, 'Description must be under 1024 characters')
    .optional()
    .or(z.literal('')),
})
type OrganizationFormValues = z.infer<typeof organizationFormSchema>

const memberFormSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  userId: z.string().min(1, 'Select a user from the dropdown'),
  role: z.enum(['owner', 'admin', 'member']),
})
type MemberFormValues = z.infer<typeof memberFormSchema>

const taskFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(4096).optional().or(z.literal('')),
  assigneeId: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'completed', 'blocked', 'cancelled']),
  dueAt: z.string().optional().or(z.literal('')),
})
type TaskFormValues = z.infer<typeof taskFormSchema>

const STATUS_LABELS: Record<
  TaskStatus,
  { label: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'default' }
> = {
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  blocked: { label: 'Blocked', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'default' },
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

const PAGE_SIZE = 10
const SUMMARY_PAGE_SIZE = 100

export default function DashboardPage() {
  const {
    memberships,
    selectedOrganization,
    selectedOrganizationId,
    setSelectedOrganizationId,
    refreshOrganizations,
  } = useDashboard()

  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])

  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const [taskFilter, setTaskFilter] = useState<'all' | TaskStatus>('all')
  const [taskPage, setTaskPage] = useState(0)
  const [taskHasMore, setTaskHasMore] = useState(false)

  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [editOrgTarget, setEditOrgTarget] = useState<Organization | null>(null)
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<Organization | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(
    null
  )
  const [selectedInvitee, setSelectedInvitee] = useState<User | null>(null)
  const memberUserIds = useMemo(
    () => members.map((member) => member.userId),
    [members]
  )

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const applyTaskPatch = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      )
      setAllTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      )
    },
    []
  )

  const createOrgForm = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', description: '' },
  })
  const editOrgForm = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', description: '' },
  })
  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { email: '', userId: '', role: 'member' },
  })
  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      dueAt: '',
    },
  })

  const selectedMembership = useMemo(
    () =>
      memberships.find(
        (membership) =>
          membership.organizationId === selectedOrganizationId ||
          membership.organization?.id === selectedOrganizationId
      ),
    [memberships, selectedOrganizationId]
  )

  const fetchMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true)
    try {
      const response = await organizationApi.listMembers(orgId)
      setMembers(response.data?.items ?? [])
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  const fetchTasksPage = useCallback(
    async (orgId: string, pageIndex: number, status: 'all' | TaskStatus) => {
      setLoadingTasks(true)
      try {
        const response = await taskApi.list({
          organizationId: orgId,
          page: pageIndex + 1,
          limit: PAGE_SIZE,
          status: status === 'all' ? undefined : status,
        })
        const payload = response.data
        const items = payload?.items ?? []
        const hasMore = Boolean(payload?.hasMore)

        if (pageIndex > 0 && items.length === 0 && !hasMore) {
          setTaskPage((prev) => Math.max(0, prev - 1))
          setTasks([])
          setTaskHasMore(false)
          return
        }

        setTasks(items)
        setTaskHasMore(hasMore)
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoadingTasks(false)
      }
    },
    []
  )

  const fetchTaskSummary = useCallback(
    async (orgId: string) => {
      setLoadingSummary(true)
      try {
        const aggregated: Task[] = []
        let page = 1
        // Hard limit to prevent runaway loops
        for (let attempts = 0; attempts < 25; attempts += 1) {
          const response = await taskApi.list({
            organizationId: orgId,
            page,
            limit: SUMMARY_PAGE_SIZE,
          })
          const payload = response.data
          const items = payload?.items ?? []
          aggregated.push(...items)

          if (!payload?.hasMore) {
            break
          }
          page += 1
        }
        setAllTasks(aggregated)
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoadingSummary(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!selectedOrganizationId) {
      setMembers([])
      setTasks([])
      setAllTasks([])
      setTaskHasMore(false)
      return
    }
    fetchMembers(selectedOrganizationId)
    fetchTaskSummary(selectedOrganizationId)
    setTaskPage(0)
  }, [selectedOrganizationId, fetchMembers, fetchTaskSummary])

  useEffect(() => {
    if (!selectedOrganizationId) return
    fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
  }, [selectedOrganizationId, taskPage, taskFilter, fetchTasksPage])

  useEffect(() => {
    setTaskPage(0)
  }, [taskFilter, selectedOrganizationId])

  useTaskEvents(
    useCallback(
      (event: TaskEventMessage) => {
        const { data } = event
        if (!selectedOrganizationId || data.organizationId !== selectedOrganizationId) {
          return
        }
        if (event.type === 'task.event.created') {
          fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
          fetchTaskSummary(selectedOrganizationId)
        } else if (event.type === 'task.event.updated') {
          const isVisible = tasks.some((task) => task.id === data.taskId)
          if (isVisible) {
            fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
          }
          fetchTaskSummary(selectedOrganizationId)
        }
      },
      [
        selectedOrganizationId,
        fetchTasksPage,
        taskPage,
        taskFilter,
        fetchTaskSummary,
        tasks,
      ]
    )
  )

  const handleCreateOrganization = createOrgForm.handleSubmit(async (values) => {
    try {
      const response = await organizationApi.create(values)
      toast.success(`“${response.data?.name ?? values.name}” created`)
      setCreateOrgOpen(false)
      createOrgForm.reset()
      await refreshOrganizations()
      if (response.data?.id) {
        setSelectedOrganizationId(response.data.id)
      }
    } catch (error) {
      handleApiError({ error, setError: createOrgForm.setError })
    }
  })

  const handleEditOrganization = editOrgForm.handleSubmit(async (values) => {
    if (!editOrgTarget) return
    try {
      await organizationApi.update(editOrgTarget.id, values)
      toast.success('Organization updated')
      setEditOrgTarget(null)
      await refreshOrganizations()
    } catch (error) {
      handleApiError({ error, setError: editOrgForm.setError })
    }
  })

  const handleDeleteOrganization = async () => {
    if (!deleteOrgTarget) return
    try {
      await organizationApi.remove(deleteOrgTarget.id)
      toast.success('Organization removed')
      setDeleteOrgTarget(null)
      await refreshOrganizations()
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleInviteMember = memberForm.handleSubmit(async (values) => {
    if (!selectedOrganizationId) return
    try {
      await organizationApi.addMember(selectedOrganizationId, {
        userId: values.userId,
        role: values.role,
      })
      toast.success('Member added')
      setMemberModalOpen(false)
      setSelectedInvitee(null)
      memberForm.reset({ email: '', userId: '', role: 'member' })
      fetchMembers(selectedOrganizationId)
    } catch (error) {
      handleApiError({ error, setError: memberForm.setError })
    }
  })

  const handleRemoveMember = async () => {
    if (!selectedOrganizationId || !memberToRemove) return
    try {
      await organizationApi.removeMember(selectedOrganizationId, memberToRemove.userId)
      toast.success('Member removed')
      setMemberToRemove(null)
      fetchMembers(selectedOrganizationId)
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleCreateTask = taskForm.handleSubmit(async (values) => {
    if (!selectedOrganizationId) return
    try {
      const payload = {
        title: values.title,
        description: values.description,
        organizationId: selectedOrganizationId,
        assigneeId: values.assigneeId || undefined,
        priority: values.priority,
        status: values.status,
        dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
      }
      await taskApi.create(payload)
      toast.success('Task created')
      setTaskModalOpen(false)
      taskForm.reset({
        title: '',
        description: '',
        assigneeId: '',
        priority: 'medium',
        status: 'open',
        dueAt: '',
      })
      fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
      fetchTaskSummary(selectedOrganizationId)
    } catch (error) {
      handleApiError({ error, setError: taskForm.setError })
    }
  })

  const handleDeleteTask = async () => {
    if (!selectedOrganizationId || !taskToDelete) return
    try {
      setDeleteLoading(true)
      await taskApi.remove(taskToDelete.id)
      toast.success('Task deleted')
      setTaskToDelete(null)
      fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
      fetchTaskSummary(selectedOrganizationId)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleteLoading(false)
    }
  }

  const openCreateTaskModal = () => {
    taskForm.reset({
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      dueAt: '',
    })
    setTaskModalOpen(true)
  }

  const highlightTotals = useMemo(() => {
    const total = allTasks.length
    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        active: 0,
        overdue: 0,
        completedPct: 0,
        activePct: 0,
      }
    }

    const completed = allTasks.filter((task) => task.status === 'completed').length
    const active = allTasks.filter((task) =>
      ['open', 'in_progress'].includes(task.status)
    ).length
    const overdue = allTasks.filter((task) => {
      if (!task.dueAt) return false
      const due = new Date(task.dueAt)
      return due.getTime() < Date.now() && task.status !== 'completed'
    }).length

    return {
      total,
      completed,
      active,
      overdue,
      completedPct: Math.round((completed / total) * 100),
      activePct: Math.round((active / total) * 100),
    }
  }, [allTasks])

  const assigneeOptions = useMemo(
    () =>
      members
        .filter((member) => member.user)
        .map((member) => ({
          value: member.userId,
          label:
            `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() ||
            member.user?.email ||
            member.userId,
          user: member.user,
        })),
    [members]
  )

  const formatAssignee = useCallback((task: Task) => {
    if (task.assignee) {
      return (
        `${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim() ||
        task.assignee.email ||
        task.assigneeId ||
        'Unassigned'
      )
    }
    return task.assigneeId || 'Unassigned'
  }, [])

  const upcomingTasks = useMemo(() => {
    const now = Date.now()
    return allTasks
      .filter((task) => {
        if (!task.dueAt) return false
        const due = new Date(task.dueAt).getTime()
        return due >= now
      })
      .sort(
        (a, b) =>
          new Date(a.dueAt ?? 0).getTime() -
          new Date(b.dueAt ?? 0).getTime()
      )
      .slice(0, 4)
  }, [allTasks])

  const recentActivity = useMemo(() => {
    return allTasks
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
      )
      .slice(0, 5)
  }, [allTasks])

  const taskRange = useMemo(() => {
    if (tasks.length === 0) {
      return { from: 0, to: 0 }
    }
    const from = taskPage * PAGE_SIZE + 1
    const to = taskPage * PAGE_SIZE + tasks.length
    return { from, to }
  }, [tasks.length, taskPage])

  const organizationRole = selectedMembership?.role

  const heroSubtitle = selectedOrganization
    ? `Stay on top of the work for ${selectedOrganization.name}.`
    : 'Select or create an organization to get started.'

  return (
    <div className="flex flex-1 flex-col gap-8 pb-16">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">
            {heroSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setCreateOrgOpen(true)}
          >
            <CalendarDays className="size-4" />
            New organization
          </Button>
          <Button
            className="gap-2"
            onClick={openCreateTaskModal}
            disabled={!selectedOrganizationId}
          >
            <Plus className="size-4" />
            New task
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[{
          icon: CheckSquare,
          label: 'Completed tasks',
          value: String(highlightTotals.completed),
          subtitle: highlightTotals.total
            ? `${highlightTotals.completedPct}% of ${highlightTotals.total} total`
            : 'No tasks yet',
          tone: 'from-emerald-500/80 to-emerald-400/60',
        }, {
          icon: Activity,
          label: 'Active tasks',
          value: String(highlightTotals.active),
          subtitle: highlightTotals.total
            ? `${highlightTotals.activePct}% currently in play`
            : 'No active work yet',
          tone: 'from-sky-500/80 to-sky-400/60',
        }, {
          icon: Clock4,
          label: 'Overdue',
          value: String(highlightTotals.overdue),
          subtitle:
            highlightTotals.overdue > 0
              ? 'Needs your attention'
              : 'All timelines are on track',
          tone:
            highlightTotals.overdue > 0
              ? 'from-amber-500/80 to-amber-400/60'
              : 'from-slate-400/60 to-slate-300/60',
        }].map(({ icon: Icon, label, value, subtitle, tone }) => (
          <Card
            key={label}
            className="overflow-hidden border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardDescription className="text-xs uppercase tracking-wide text-slate-500">
                  {label}
                </CardDescription>
                <CardTitle className="text-2xl font-semibold text-slate-900">
                  {loadingSummary ? '—' : value}
                </CardTitle>
              </div>
              <div
                className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-inner ${tone}`}
              >
                <Icon className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                {loadingSummary ? 'Loading summary…' : subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
        <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Tasks
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Manage everything assigned to this organization.
              </CardDescription>
            </div>
            <Select
              value={taskFilter}
              onChange={(event) =>
                setTaskFilter(event.target.value as 'all' | TaskStatus)
              }
              containerClassName="w-full min-w-[160px] max-w-xs md:max-w-[200px]"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loadingTasks ? (
              <p className="py-6 text-sm text-slate-500">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                {taskFilter === 'all'
                  ? 'No tasks yet. Create your first task to get started.'
                  : 'No tasks match this filter.'}
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Assignee</th>
                    <th className="py-2 pr-4">Due</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="align-top">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/tasks/${task.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {task.title}
                        </Link>
                        {task.description && (
                          <p className="text-xs text-slate-500">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <TaskStatusInlineSelect
                          taskId={task.id}
                          value={task.status}
                          onUpdated={(nextStatus) =>
                            applyTaskPatch(task.id, { status: nextStatus })
                          }
                          className="min-w-[140px] text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <TaskPriorityInlineSelect
                          taskId={task.id}
                          value={task.priority}
                          onUpdated={(nextPriority) =>
                            applyTaskPatch(task.id, { priority: nextPriority })
                          }
                          className="min-w-[130px] text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        <TaskAssigneeInlineSelect
                          taskId={task.id}
                          value={task.assigneeId ?? ''}
                          options={assigneeOptions}
                          fallbackLabel={formatAssignee(task)}
                          onUpdated={(nextId, user) =>
                            applyTaskPatch(task.id, {
                              assigneeId: nextId || undefined,
                              assignee: user ?? (nextId ? task.assignee : undefined),
                            })
                          }
                          className="min-w-[150px] text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {task.dueAt
                          ? new Date(task.dueAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-rose-400 hover:text-rose-600"
                            onClick={() => setTaskToDelete(task)}
                            aria-label="Delete task"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tasks.length > 0 && (taskPage > 0 || taskHasMore) && (
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <p>
                  Showing {taskRange.from}–{taskRange.to}
                  {taskHasMore ? ' (more available)' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={taskPage === 0}
                    onClick={() =>
                      setTaskPage((prev) => Math.max(0, prev - 1))
                    }
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-xs font-medium text-slate-600">
                    Page {taskPage + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!taskHasMore}
                    onClick={() => setTaskPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Team members
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Invite collaborators and manage their roles.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setMemberModalOpen(true)}
                disabled={!selectedOrganizationId}
              >
                <Plus className="mr-2 size-4" />
                Invite
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingMembers ? (
                <p className="text-sm text-slate-500">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No members yet. Invite teammates to collaborate.
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                        {member.user
                          ? `${member.user.firstName?.[0] ?? ''}${
                              member.user.lastName?.[0] ?? ''
                            }`.toUpperCase()
                          : 'M'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {member.user
                            ? `${member.user.firstName} ${member.user.lastName}`
                            : member.userId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {member.user?.email ?? 'No email on record'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="default">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-rose-400 hover:text-rose-600"
                          onClick={() => setMemberToRemove(member)}
                          aria-label="Remove member"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Upcoming deadlines
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Keep an eye on what&apos;s coming next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No upcoming tasks scheduled.
                </p>
              ) : (
                upcomingTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/dashboard/tasks/${task.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        Due {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    <Badge tone={STATUS_LABELS[task.status].tone}>
                      {STATUS_LABELS[task.status].label}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Recent activity
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Latest updates across tasks in this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nothing to report yet. Activity will appear here as work progresses.
              </p>
            ) : (
              recentActivity.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated{' '}
                      {new Date(
                        task.updatedAt ?? task.createdAt ?? Date.now()
                      ).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={STATUS_LABELS[task.status].tone}>
                    {STATUS_LABELS[task.status].label}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Modal
        open={createOrgOpen}
        onClose={() => {
          setCreateOrgOpen(false)
          createOrgForm.reset()
        }}
        title="Create organization"
        description="Set up a new space for your team."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreateOrgOpen(false)
                createOrgForm.reset()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-org-form"
              className="min-w-[120px]"
              disabled={createOrgForm.formState.isSubmitting}
            >
              {createOrgForm.formState.isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          id="create-org-form"
          onSubmit={handleCreateOrganization}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input placeholder="Acme Inc." {...createOrgForm.register('name')} />
            {createOrgForm.formState.errors.name && (
              <p className="text-xs text-rose-500">
                {createOrgForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              placeholder="What will this organization be used for?"
              {...createOrgForm.register('description')}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editOrgTarget)}
        onClose={() => {
          setEditOrgTarget(null)
          editOrgForm.reset()
        }}
        title="Edit organization"
        description="Update the name or description."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEditOrgTarget(null)
                editOrgForm.reset()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-org-form"
              className="min-w-[130px]"
              disabled={editOrgForm.formState.isSubmitting}
            >
              {editOrgForm.formState.isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form
          id="edit-org-form"
          onSubmit={handleEditOrganization}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input placeholder="Acme Inc." {...editOrgForm.register('name')} />
            {editOrgForm.formState.errors.name && (
              <p className="text-xs text-rose-500">
                {editOrgForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              placeholder="How will this organization be used?"
              {...editOrgForm.register('description')}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteOrgTarget)}
        onClose={() => setDeleteOrgTarget(null)}
        title="Remove organization"
        description="This will permanently delete the organization and its data."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOrgTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleDeleteOrganization}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete “{deleteOrgTarget?.name}”? This action cannot
          be undone.
        </p>
      </Modal>

      <Modal
        open={memberModalOpen}
        onClose={() => {
          setMemberModalOpen(false)
          setSelectedInvitee(null)
          memberForm.reset({ email: '', userId: '', role: 'member' })
        }}
        title="Invite member"
        description="Add an existing user to this organization."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setMemberModalOpen(false)
                setSelectedInvitee(null)
                memberForm.reset({ email: '', userId: '', role: 'member' })
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="member-form"
              className="min-w-[120px]"
              disabled={memberForm.formState.isSubmitting}
            >
              {memberForm.formState.isSubmitting ? 'Inviting…' : 'Send invite'}
            </Button>
          </>
        }
      >
        <form id="member-form" onSubmit={handleInviteMember} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <UserEmailSelect
              value={memberForm.watch('email') ?? ''}
              onValueChange={(email) => {
                setSelectedInvitee(null)
                memberForm.setValue('email', email, { shouldDirty: true })
                memberForm.setValue('userId', '', {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
              onUserSelected={(user) => {
                setSelectedInvitee(user)
                memberForm.setValue('email', user.email, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                memberForm.setValue('userId', user.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
              selectedUser={selectedInvitee}
              error={
                memberForm.formState.errors.email?.message ??
                memberForm.formState.errors.userId?.message
              }
              showError={memberForm.formState.submitCount > 0}
              disabled={memberForm.formState.isSubmitting}
              excludeUserIds={memberUserIds}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <Select {...memberForm.register('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        title="Remove member"
        description="The member will lose access to this organization immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleRemoveMember}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Remove{' '}
          <strong>
            {memberToRemove?.user
              ? `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`
              : memberToRemove?.userId}
          </strong>{' '}
          from this organization?
        </p>
      </Modal>

      <Modal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false)
          taskForm.reset({
            title: '',
            description: '',
            assigneeId: '',
            priority: 'medium',
            status: 'open',
            dueAt: '',
          })
        }}
        title="Create task"
        description="Assign ownership and set expectations for this task."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setTaskModalOpen(false)
                taskForm.reset({
                  title: '',
                  description: '',
                  assigneeId: '',
                  priority: 'medium',
                  status: 'open',
                  dueAt: '',
                })
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="task-form"
              className="min-w-[130px]"
              disabled={taskForm.formState.isSubmitting}
            >
              {taskForm.formState.isSubmitting ? 'Creating…' : 'Create task'}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={handleCreateTask} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <Input
              placeholder="Sprint planning"
              {...taskForm.register('title', {
                required: 'Title is required',
                minLength: {
                  value: 3,
                  message: 'Title must be at least 3 characters',
                },
              })}
            />
            {taskForm.formState.errors.title && (
              <p className="text-xs text-rose-500">
                {taskForm.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              placeholder="Add context, acceptance criteria, or links…"
              {...taskForm.register('description')}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Assignee
              </label>
              <Select {...taskForm.register('assigneeId')}>
                <option value="">Unassigned</option>
                {members.map((member) =>
                  member.user ? (
                    <option key={member.userId} value={member.userId}>
                      {member.user.firstName} {member.user.lastName}
                    </option>
                  ) : null
                )}
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Priority
              </label>
              <Select {...taskForm.register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Status
              </label>
              <Select {...taskForm.register('status')}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Due date
              </label>
              <Controller
                control={taskForm.control}
                name="dueAt"
                render={({ field }) => (
                  <DateTimePickerField
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder="Select a date"
                  />
                )}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => (deleteLoading ? null : setTaskToDelete(null))}
        title="Delete task"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setTaskToDelete(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleDeleteTask}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete task'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <strong>{taskToDelete?.title}</strong>?
        </p>
      </Modal>
    </div>
  )
}
