'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Activity,
  CalendarDays,
  CheckSquare,
  Clock4,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import {
  organizationApi,
  taskApi,
  userApi,
} from '@/lib/api'
import { handleApiError } from '@/lib/utils/error-handler'
import type {
  Organization,
  OrganizationMember,
  Task,
  TaskPriority,
  TaskStatus,
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

type TaskFormValues = {
  title: string
  description: string
  assigneeId: string
  priority: TaskPriority
  status: TaskStatus
  dueAt: string
}

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

const PRIORITY_LABELS: Record<
  TaskPriority,
  { label: string; tone: 'default' | 'info' | 'warning' | 'danger' }
> = {
  low: { label: 'Low', tone: 'default' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
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

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const createOrgForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: '', description: '' },
  })
  const editOrgForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: '', description: '' },
  })
  const memberForm = useForm<{ email: string; role: 'owner' | 'admin' | 'member' }>(
    { defaultValues: { email: '', role: 'member' } }
  )
  const taskForm = useForm<TaskFormValues>({
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
      const usersResponse = await userApi.list({
        q: values.email,
        limit: 1,
      })
      const targetUser = usersResponse.data?.items?.[0]
      if (!targetUser) {
        toast.error('User not found', {
          description: 'Make sure the user has an account.',
        })
        return
      }

      await organizationApi.addMember(selectedOrganizationId, {
        userId: targetUser.id,
        role: values.role,
      })
      toast.success('Member added')
      setMemberModalOpen(false)
      memberForm.reset()
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
      if (taskToEdit) {
        await taskApi.update(taskToEdit.id, payload)
        toast.success('Task updated')
      } else {
        await taskApi.create(payload)
        toast.success('Task created')
      }
      setTaskModalOpen(false)
      setTaskToEdit(null)
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
      await taskApi.remove(taskToDelete.id)
      toast.success('Task deleted')
      setTaskToDelete(null)
      fetchTasksPage(selectedOrganizationId, taskPage, taskFilter)
      fetchTaskSummary(selectedOrganizationId)
    } catch (error) {
      handleApiError({ error })
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
    setTaskToEdit(null)
    setTaskModalOpen(true)
  }

  const openEditTaskModal = (task: Task) => {
    setTaskToEdit(task)
    taskForm.reset({
      title: task.title,
      description: task.description ?? '',
      assigneeId: task.assigneeId ?? '',
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt
        ? new Date(task.dueAt).toISOString().slice(0, 16)
        : '',
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
              containerClassName="min-w-[160px]"
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
                    <th className="py-2 pr-4">Assignee</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Due</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="cursor-pointer align-top transition hover:bg-slate-50"
                      onClick={() => openEditTaskModal(task)}
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-slate-500">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {task.assignee
                          ? `${task.assignee.firstName} ${task.assignee.lastName}`
                          : 'Unassigned'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={PRIORITY_LABELS[task.priority].tone}>
                          {PRIORITY_LABELS[task.priority].label}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_LABELS[task.status].tone}>
                          {STATUS_LABELS[task.status].label}
                        </Badge>
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
                            className="text-slate-400 hover:text-slate-700"
                            onClick={(event) => {
                              event.stopPropagation()
                              openEditTaskModal(task)
                            }}
                            aria-label="Edit task"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-rose-400 hover:text-rose-600"
                            onClick={(event) => {
                              event.stopPropagation()
                              setTaskToDelete(task)
                            }}
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
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm"
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
                  </div>
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
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm"
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
                </div>
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
            <Input
              placeholder="Acme Inc."
              {...createOrgForm.register('name', {
                required: 'Name is required',
                minLength: {
                  value: 2,
                  message: 'Name should be at least 2 characters',
                },
              })}
            />
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
            <Input
              placeholder="Acme Inc."
              {...editOrgForm.register('name', {
                required: 'Name is required',
                minLength: {
                  value: 2,
                  message: 'Name should be at least 2 characters',
                },
              })}
            />
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
            <Button variant="destructive" onClick={handleDeleteOrganization}>
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
          memberForm.reset()
        }}
        title="Invite member"
        description="Add an existing user to this organization."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setMemberModalOpen(false)
                memberForm.reset()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="member-form"
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
            <Input
              type="email"
              placeholder="name@example.com"
              {...memberForm.register('email', { required: 'Email is required' })}
            />
            {memberForm.formState.errors.email && (
              <p className="text-xs text-rose-500">
                {memberForm.formState.errors.email.message}
              </p>
            )}
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
            <Button variant="destructive" onClick={handleRemoveMember}>
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
          setTaskToEdit(null)
          taskForm.reset({
            title: '',
            description: '',
            assigneeId: '',
            priority: 'medium',
            status: 'open',
            dueAt: '',
          })
        }}
        title={taskToEdit ? 'Edit task' : 'Create task'}
        description={
          taskToEdit
            ? 'Update task details and assignments.'
            : 'Assign ownership and set expectations for this task.'
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setTaskModalOpen(false)
                setTaskToEdit(null)
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
              disabled={taskForm.formState.isSubmitting}
            >
              {taskForm.formState.isSubmitting
                ? taskToEdit
                  ? 'Saving…'
                  : 'Creating…'
                : taskToEdit
                  ? 'Save changes'
                  : 'Create task'}
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
              <Input type="datetime-local" {...taskForm.register('dueAt')} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Delete task"
        description="This action cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTask}>
              Delete task
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
