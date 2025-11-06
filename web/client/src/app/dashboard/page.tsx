'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import {
  Activity,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock4,
  Edit3,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { handleApiError } from '@/lib/utils/error-handler'
import {
  Organization,
  OrganizationMember,
  Task,
  TaskPriority,
  TaskStatus,
} from '@/lib/types/api'
import {
  authApi,
  organizationApi,
  taskApi,
  userApi,
} from '@/lib/api'
import { useAuthStore } from '@/store/auth'
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

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Layers, label: 'Organizations', href: '/dashboard/organizations' },
  { icon: CheckSquare, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: CalendarDays, label: 'Calendar', href: '/dashboard/calendar' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
]

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

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearAuth } = useAuthStore()

  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)

  const [collapsed, setCollapsed] = useState(false)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [editOrgTarget, setEditOrgTarget] = useState<Organization | null>(null)
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<Organization | null>(null)
const [memberModalOpen, setMemberModalOpen] = useState(false)
const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null)
const [taskModalOpen, setTaskModalOpen] = useState(false)
const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
const [taskFilter, setTaskFilter] = useState<'all' | TaskStatus>('all')
const pageSize = 10
const [taskPage, setTaskPage] = useState(0)
const [taskHasMore, setTaskHasMore] = useState(false)

  const orgMenuRef = useRef<HTMLDivElement | null>(null)

  const createOrgForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: '', description: '' },
  })
  const editOrgForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: '', description: '' },
  })
  const memberForm = useForm<{ email: string; role: 'owner' | 'admin' | 'member' }>({
    defaultValues: { email: '', role: 'member' },
  })
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

  const initials = useMemo(() => {
    if (!user) return 'TF'
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  }, [user])

  const selectedOrganization = useMemo(() => {
    if (!selectedOrgId) return undefined
    return organizations.find((org) => org.id === selectedOrgId)
  }, [organizations, selectedOrgId])

  const selectedMembership = useMemo(() => {
    if (!selectedOrgId) return undefined
    return memberships.find(
      (membership) =>
        membership.organizationId === selectedOrgId ||
        membership.organization?.id === selectedOrgId
    )
  }, [memberships, selectedOrgId])

  useEffect(() => {
    if (!orgMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        orgMenuRef.current &&
        !orgMenuRef.current.contains(event.target as Node)
      ) {
        setOrgMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [orgMenuOpen])

  const fetchOrganizations = useCallback(async () => {
    setLoadingOrgs(true)
    try {
      const response = await organizationApi.listMine()
      const items = response.data?.items ?? []
      setMemberships(items)
      const unique = new Map<string, Organization>()
      items.forEach((membership) => {
        const org = membership.organization
        if (org) {
          unique.set(org.id, org)
        }
      })
      const nextOrgs = Array.from(unique.values())
      setOrganizations(nextOrgs)

      if (!selectedOrgId && nextOrgs.length > 0) {
        setSelectedOrgId(nextOrgs[0].id)
      } else if (
        selectedOrgId &&
        nextOrgs.every((org) => org.id !== selectedOrgId)
      ) {
        setSelectedOrgId(nextOrgs[0]?.id ?? null)
      }
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoadingOrgs(false)
    }
  }, [selectedOrgId])

  const fetchMembers = useCallback(
    async (orgId: string) => {
      setLoadingMembers(true)
      try {
        const response = await organizationApi.listMembers(orgId)
        setMembers(response.data?.items ?? [])
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoadingMembers(false)
      }
    },
    []
  )

  const fetchTasks = useCallback(
    async (orgId: string, pageIndex: number, status: 'all' | TaskStatus) => {
      setLoadingTasks(true)
      try {
        const response = await taskApi.list({
          organizationId: orgId,
          page: pageIndex + 1,
          limit: pageSize,
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
    [pageSize]
  )

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

useEffect(() => {
  if (!selectedOrgId) {
    setMembers([])
    setTasks([])
    setTaskHasMore(false)
    return
  }
  fetchMembers(selectedOrgId)
}, [selectedOrgId, fetchMembers])

useEffect(() => {
  if (!selectedOrgId) {
    return
  }
  fetchTasks(selectedOrgId, taskPage, taskFilter)
}, [selectedOrgId, taskPage, taskFilter, fetchTasks])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('logout', error)
    } finally {
      clearAuth()
      toast.info('Signed out')
      router.push('/auth/login')
    }
  }

  const highlights = useMemo(() => {
    const total = tasks.length || 1
    const completed = tasks.filter((task) => task.status === 'completed').length
    const active = tasks.filter((task) =>
      ['open', 'in_progress'].includes(task.status)
    ).length
    const overdue = tasks.filter((task) => {
      if (!task.dueAt) return false
      const due = new Date(task.dueAt)
      return due.getTime() < Date.now() && task.status !== 'completed'
    }).length

    return [
      {
        icon: CheckSquare,
        label: 'Completed tasks',
        value: String(completed),
        subtitle: `${Math.round((completed / total) * 100)}% of total`,
        tone: 'from-emerald-500/80 to-emerald-400/60',
      },
      {
        icon: Activity,
        label: 'Active tasks',
        value: String(active),
        subtitle: `${Math.round((active / total) * 100)}% currently in play`,
        tone: 'from-sky-500/80 to-sky-400/60',
      },
      {
        icon: Clock4,
        label: 'Overdue items',
        value: String(overdue),
        subtitle:
          overdue > 0
            ? 'Needs your attention'
            : 'All timelines are on track',
        tone: overdue > 0
          ? 'from-amber-500/80 to-amber-400/60'
          : 'from-slate-400/60 to-slate-300/60',
      },
    ] as const
  }, [tasks])

useEffect(() => {
  setTaskPage(0)
}, [taskFilter, selectedOrgId])

  const upcomingTasks = useMemo(() => {
    const now = Date.now()
    return tasks
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
  }, [tasks])

const recentActivity = useMemo(() => {
  return tasks
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
    )
    .slice(0, 5)
}, [tasks])

const taskRange = useMemo(() => {
  if (tasks.length === 0) {
    return { from: 0, to: 0 }
  }
  const from = taskPage * pageSize + 1
  const to = taskPage * pageSize + tasks.length
  return { from, to }
}, [tasks.length, taskPage, pageSize])

const organizationRole = selectedMembership?.role

  const handleSelectOrganization = (org: Organization) => {
    setSelectedOrgId(org.id)
    setOrgMenuOpen(false)
  }

  const handleCreateOrganization = createOrgForm.handleSubmit(
    async (values) => {
      try {
        const response = await organizationApi.create(values)
        toast.success(`“${response.data?.name ?? values.name}” created`)
        setCreateOrgOpen(false)
        createOrgForm.reset()
        await fetchOrganizations()
      } catch (error) {
        handleApiError({ error, setError: createOrgForm.setError })
      }
    }
  )

  const handleEditOrganization = editOrgForm.handleSubmit(async (values) => {
    if (!editOrgTarget) return
    try {
      await organizationApi.update(editOrgTarget.id, values)
      toast.success('Organization updated')
      setEditOrgTarget(null)
      await fetchOrganizations()
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
      await fetchOrganizations()
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleInviteMember = memberForm.handleSubmit(async (values) => {
    if (!selectedOrgId) return
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

      await organizationApi.addMember(selectedOrgId, {
        userId: targetUser.id,
        role: values.role,
      })
      toast.success('Member added')
      setMemberModalOpen(false)
      memberForm.reset()
      fetchMembers(selectedOrgId)
    } catch (error) {
      handleApiError({ error, setError: memberForm.setError })
    }
  })

  const handleRemoveMember = async () => {
    if (!selectedOrgId || !memberToRemove) return
    try {
      await organizationApi.removeMember(selectedOrgId, memberToRemove.userId)
      toast.success('Member removed')
      setMemberToRemove(null)
      fetchMembers(selectedOrgId)
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleCreateTask = taskForm.handleSubmit(async (values) => {
    if (!selectedOrgId) return
    try {
      const payload = {
        title: values.title,
        description: values.description,
        organizationId: selectedOrgId,
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
      fetchTasks(selectedOrgId, taskPage, taskFilter)
    } catch (error) {
      handleApiError({ error, setError: taskForm.setError })
    }
  })

  const handleDeleteTask = async () => {
    if (!selectedOrgId || !taskToDelete) return
    try {
      await taskApi.remove(taskToDelete.id)
      toast.success('Task deleted')
      setTaskToDelete(null)
      fetchTasks(selectedOrgId, taskPage, taskFilter)
    } catch (error) {
      handleApiError({ error })
    }
  }

  const openEditOrganization = (org: Organization) => {
    setEditOrgTarget(org)
    editOrgForm.reset({
      name: org.name,
      description: org.description ?? '',
    })
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
      dueAt: task.dueAt ? toDateInputValue(task.dueAt) : '',
    })
    setTaskModalOpen(true)
  }

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
      <aside
        className={cn(
          'hidden border-r border-slate-200/80 bg-white/80 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/70 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <Menu className="size-5" />
          </Button>
          {!collapsed && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Task Flow
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Workspace
              </p>
            </div>
          )}
        </div>

        <div className="relative border-b border-slate-200/70 px-3 py-4" ref={orgMenuRef}>
          <button
            className={cn(
              'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:bg-slate-50',
              collapsed && 'px-2 py-2 justify-center'
            )}
            onClick={() => setOrgMenuOpen((prev) => !prev)}
          >
            {collapsed ? (
              <Layers className="size-4 text-slate-500" />
            ) : (
              <>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Organization
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {selectedOrganization?.name ?? 'Select organization'}
                  </span>
                </div>
                {orgMenuOpen ? (
                  <ChevronUp className="size-4 text-slate-500" />
                ) : (
                  <ChevronDown className="size-4 text-slate-500" />
                )}
              </>
            )}
          </button>

          {orgMenuOpen && !collapsed && (
            <div className="absolute left-3 right-3 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="max-h-64 overflow-y-auto py-2">
                {loadingOrgs && (
                  <p className="px-4 py-2 text-sm text-slate-500">
                    Loading organizations…
                  </p>
                )}
                {!loadingOrgs && organizations.length === 0 && (
                  <p className="px-4 py-2 text-sm text-slate-500">
                    No organizations yet. Create one to get started.
                  </p>
                )}
                {organizations.map((org) => {
                  const role = memberships.find(
                    (membership) =>
                      membership.organizationId === org.id ||
                      membership.organization?.id === org.id
                  )?.role

                  const isActive = selectedOrgId === org.id
                  return (
                    <div
                      key={org.id}
                      className="flex items-center justify-between px-2"
                    >
                      <button
                        onClick={() => handleSelectOrganization(org)}
                        className={cn(
                          'flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        <Layers className="size-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">{org.name}</span>
                          {role && (
                            <span className="text-xs text-slate-400">
                              {ROLE_LABELS[role] ?? role}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 px-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-400 hover:text-slate-600"
                          onClick={() => openEditOrganization(org)}
                          aria-label="Edit organization"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-400 hover:text-rose-500"
                          onClick={() => setDeleteOrgTarget(org)}
                          aria-label="Delete organization"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setCreateOrgOpen(true)
                    setOrgMenuOpen(false)
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  New organization
                </Button>
              </div>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive =
              pathname === href || pathname?.startsWith(`${href}/`)
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className="size-4" />
                  {!collapsed && <span>{label}</span>}
                </span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500">
                Stay on top of the work for{' '}
                {selectedOrganization?.name ?? 'your workspace'}.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search tasks, projects, teammates…"
                  className="w-72 bg-white pl-9 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500 hover:bg-slate-100"
              >
                <Bell className="size-5" />
              </Button>
              <Button
                onClick={openCreateTaskModal}
                className="hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-slate-500/20 transition hover:bg-slate-800 md:flex"
              >
                <Plus className="size-4" />
                New task
              </Button>
              <div className="hidden md:flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm shadow-sm">
                <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {user ? `${user.firstName} ${user.lastName}` : 'Team Flow'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {organizationRole
                      ? ROLE_LABELS[organizationRole] ?? organizationRole
                      : user?.email ?? 'team@taskflow.app'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500 hover:bg-slate-100"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-8 px-4 pb-16 pt-8 md:px-8">
          <section className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ icon: Icon, label, value, subtitle, tone }) => (
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
                      {value}
                    </CardTitle>
                  </div>
                  <div
                    className={cn(
                      'flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-inner',
                      tone
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">{subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
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
                <div className="flex items-center gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={openCreateTaskModal}
                  >
                    <Plus className="size-4" />
                    Task
                  </Button>
                </div>
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
                        <tr key={task.id} className="align-top">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-slate-900">
                              {task.title}
                            </p>
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
                                onClick={() => openEditTaskModal(task)}
                                aria-label="Edit task"
                              >
                                <Pencil className="size-4" />
                              </Button>
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
                    disabled={!selectedOrgId}
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
                    What’s next for the team this week.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingTasks.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No upcoming tasks with due dates.
                    </p>
                  ) : (
                    upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-slate-500">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Due{' '}
                            {task.dueAt
                              ? new Date(task.dueAt).toLocaleString()
                              : '—'}
                          </span>
                          <span>
                            {task.assignee
                              ? `${task.assignee.firstName} ${task.assignee.lastName}`
                              : 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-6">
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
                    Nothing to report yet. Activity will appear here as work
                    progresses.
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
        </main>
      </div>

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
            <Textarea {...editOrgForm.register('description')} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteOrgTarget)}
        onClose={() => setDeleteOrgTarget(null)}
        title="Delete organization"
        description="This will remove the organization and its data for all members."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOrgTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrganization}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-rose-500">
            {deleteOrgTarget?.name}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        open={memberModalOpen}
        onClose={() => {
          setMemberModalOpen(false)
          memberForm.reset({ email: '', role: 'member' })
        }}
        title="Invite member"
        description="Invite someone who already has access to Task Flow."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setMemberModalOpen(false)
                memberForm.reset({ email: '', role: 'member' })
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="invite-member-form"
              disabled={memberForm.formState.isSubmitting || !selectedOrgId}
            >
              {memberForm.formState.isSubmitting ? 'Sending…' : 'Invite'}
            </Button>
          </>
        }
      >
        <form
          id="invite-member-form"
          onSubmit={handleInviteMember}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Email address
            </label>
            <Input
              type="email"
              placeholder="person@company.com"
              {...memberForm.register('email', {
                required: 'Email is required',
              })}
            />
            {memberForm.formState.errors.email && (
              <p className="text-xs text-rose-500">
                {memberForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Role
            </label>
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
        description="They will immediately lose access to this organization."
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
          <span className="font-semibold text-rose-500">
            {memberToRemove?.user
              ? `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`
              : memberToRemove?.userId}
          </span>{' '}
          from{' '}
          <span className="font-semibold text-slate-900">
            {selectedOrganization?.name}
          </span>
          ?
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
        description="Keep everyone aligned with clear ownership and priorities."
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
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Title
            </label>
            <Input
              placeholder="Title"
              {...taskForm.register('title', {
                required: 'Title is required',
              })}
            />
            {taskForm.formState.errors.title && (
              <p className="text-xs text-rose-500">
                {taskForm.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              placeholder="Context, checklist, acceptance criteria…"
              {...taskForm.register('description')}
            />
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
            <div className="grid gap-1.5">
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
            <div className="grid gap-1.5">
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
          <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
            <div className="grid gap-1.5">
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
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Due date
              </label>
              <Input
                type="datetime-local"
                {...taskForm.register('dueAt')}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="Delete task"
        description="This task will be removed from the project."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTask}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-rose-500">
            {taskToDelete?.title}
          </span>
          ?
        </p>
      </Modal>
    </div>
  )
}

function toDateInputValue(isoString: string) {
  const date = new Date(isoString)
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}
