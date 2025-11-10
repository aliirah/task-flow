'use client'

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  CheckSquare,
  ChevronDown,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  UserCheck,
} from 'lucide-react'

import { authApi, organizationApi } from '@/lib/api'
import type { Organization, OrganizationMember } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { cn } from '@/lib/utils'
import { buildWsUrl } from '@/lib/utils/ws'
import { TaskEventContext, TaskEventListener } from '@/hooks/useTaskEvents'
import type { TaskEventMessage } from '@/lib/types/ws'
import { describeTaskEvent } from '@/lib/utils/task-events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import Cookies from 'js-cookie'

type DashboardContextValue = {
  organizations: Organization[]
  memberships: OrganizationMember[]
  selectedOrganizationId: string | null
  selectedOrganization?: Organization
  setSelectedOrganizationId: (orgId: string | null) => void
  refreshOrganizations: () => Promise<void>
  loadingOrganizations: boolean
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
)

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext)
  if (!value) {
    throw new Error('useDashboard must be used within DashboardShell')
  }
  return value
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Layers, label: 'Organizations', href: '/dashboard/organizations' },
  { icon: CheckSquare, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: UserCheck, label: 'My Tasks', href: '/dashboard/my-tasks' },
  { icon: Activity, label: 'Profile', href: '/dashboard/profile' },
]

const STORAGE_KEY = 'dashboard:selected-org'

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, refreshToken, clearAuth, accessToken } = useAuthStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [orgQuery, setOrgQuery] = useState('')
  const orgMenuRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const storedOrgRef = useRef<string | null>(null)

  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<
    string | null
  >(null)
  const [selectionHydrated, setSelectionHydrated] = useState(false)
  const taskEventListenersRef = useRef<Set<TaskEventListener>>(new Set())
  const userRef = useRef(user)
  const selectedOrgRef = useRef<string | null>(selectedOrganizationId)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    selectedOrgRef.current = selectedOrganizationId
  }, [selectedOrganizationId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    storedOrgRef.current = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshOrganizations = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setOrganizations([])
      setSelectedOrganizationIdState(null)
      setSelectionHydrated(true)
      return
    }
    setLoadingOrganizations(true)
    try {
      const response = await organizationApi.listMine()
      const items = response.data?.items ?? []
      setMemberships(items)

      const unique = new Map<string, Organization>()
      items.forEach((membership) => {
        if (membership.organization) {
          unique.set(membership.organization.id, membership.organization)
        }
      })
      const list = Array.from(unique.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      setOrganizations(list)

      setSelectedOrganizationIdState((current) => {
        const stored = storedOrgRef.current
        storedOrgRef.current = null

        if (current && list.some((org) => org.id === current)) {
          return current
        }
        if (stored && list.some((org) => org.id === stored)) {
          return stored
        }
        return list[0]?.id ?? null
      })
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoadingOrganizations(false)
      setSelectionHydrated(true)
    }
  }, [user])

  useEffect(() => {
    refreshOrganizations()
  }, [refreshOrganizations])

  useEffect(() => {
    if (!selectionHydrated || typeof window === 'undefined') return
    if (selectedOrganizationId) {
      window.localStorage.setItem(STORAGE_KEY, selectedOrganizationId)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedOrganizationId, selectionHydrated])

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

  useEffect(() => {
    if (!orgMenuOpen) {
      setOrgQuery('')
    }
  }, [orgMenuOpen])

  useEffect(() => {
    if (!orgMenuOpen) {
      setOrgQuery('')
    }
  }, [orgMenuOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  const subscribeTaskEvents = useCallback((listener: TaskEventListener) => {
    taskEventListenersRef.current.add(listener)
    return () => {
      taskEventListenersRef.current.delete(listener)
    }
  }, [])

  const broadcastTaskEvent = useCallback((event: TaskEventMessage) => {
    taskEventListenersRef.current.forEach((listener) => {
      try {
        listener(event)
      } catch {
        // ignore listener errors
      }
    })
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }
    let stop = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let socket: WebSocket | null = null

    const connect = () => {
      const wsUrl = buildWsUrl(`/api/ws?token=${encodeURIComponent(accessToken)}`)
      socket = new WebSocket(wsUrl)

      socket.onclose = () => {
        if (stop) {
          return
        }
        retryTimer = setTimeout(connect, 5000)
      }

      socket.onerror = () => {
        socket?.close()
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.debug('[TODO-remove] incoming ws payload', message)
          if (!message?.type) {
            return
          }
          if (message.type === 'connection.established') {
            return
          }
          const isTaskEvent =
            message.type === 'task.event.created' ||
            message.type === 'task.event.updated'
          if (!isTaskEvent || !message.data) {
            return
          }
          const senderId =
            message.data.triggeredById ?? message.data.reporterId ?? null
          if (senderId && senderId === userRef.current?.id) {
            console.debug(
              '[TODO-remove] skipping self-originated event',
              message.type,
              senderId
            )
            return
          }
          const taskEvent = message as TaskEventMessage
          console.debug('[TODO-remove] broadcasting task event', taskEvent)
          broadcastTaskEvent(taskEvent)
          const currentOrg = selectedOrgRef.current
          if (message.data.organizationId && message.data.organizationId === currentOrg) {
            const content = describeTaskEvent(taskEvent)
            toast.success(content.title, {
              description: content.description,
            })
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    connect()

    return () => {
      stop = true
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
      socket?.close()
    }
  }, [accessToken, broadcastTaskEvent])

  const setSelectedOrganizationId = useCallback(
    (orgId: string | null) => {
      if (orgId && !organizations.some((org) => org.id === orgId)) {
        return
      }
      setSelectedOrganizationIdState((current) => {
        if (current === orgId) {
          return current
        }
        if (orgId) {
          router.push('/dashboard')
        }
        return orgId
      })
      setOrgMenuOpen(false)
    },
    [organizations, router]
  )

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  )

  const filteredOrganizations = useMemo(() => {
    if (!orgQuery.trim()) {
      return organizations
    }
    const query = orgQuery.toLowerCase()
    return organizations.filter((org) =>
      [org.name, org.description].some((value) =>
        value?.toLowerCase().includes(query)
      )
    )
  }, [organizations, orgQuery])

  const selectedMembership = useMemo(
    () =>
      memberships.find(
        (membership) =>
          membership.organizationId === selectedOrganizationId ||
          membership.organization?.id === selectedOrganizationId
      ),
    [memberships, selectedOrganizationId]
  )

  const initials = useMemo(() => {
    if (!user) return 'TF'
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  }, [user])

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
      toast.success('Signed out')
    } catch (error) {
      console.error('logout failed', error)
    } finally {
      clearAuth()
      Cookies.remove('accessToken')
      setSelectedOrganizationIdState(null)
      setIsLoggingOut(false)
      setLogoutConfirmOpen(false)
      router.replace('/auth/login')
    }
  }, [clearAuth, router])

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      organizations,
      memberships,
      selectedOrganizationId,
      selectedOrganization,
      setSelectedOrganizationId,
      refreshOrganizations,
      loadingOrganizations,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [
      organizations,
      memberships,
      selectedOrganizationId,
      selectedOrganization,
      setSelectedOrganizationId,
      refreshOrganizations,
      loadingOrganizations,
      sidebarCollapsed,
    ]
  )

  const taskEventContextValue = useMemo(
    () => ({
      subscribe: subscribeTaskEvents,
    }),
    [subscribeTaskEvents]
  )

  return (
    <TaskEventContext.Provider value={taskEventContextValue}>
      <DashboardContext.Provider value={contextValue}>
          <div className="flex min-h-screen bg-slate-50">
            <aside
              className={cn(
                'hidden min-h-screen border-r border-slate-200 bg-white/80 backdrop-blur-md transition-all duration-300 md:flex md:flex-col',
                sidebarCollapsed ? 'w-[84px]' : 'w-64'
              )}
            >
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-lg">
              TF
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">
                  Task Flow
                </span>
                <span className="text-xs text-slate-500">
                  Organize your work
                </span>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
            {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
              const isRoot = href === '/dashboard'
              const isActive = isRoot
                ? pathname === '/dashboard'
                : pathname === href || pathname?.startsWith(`${href}/`)
              const content = (
                <span
                  className={cn(
                    'group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    sidebarCollapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className="size-4" />
                  {!sidebarCollapsed && <span>{label}</span>}
                </span>
              )

              if (sidebarCollapsed) {
                return (
                  <Link key={href} href={href} className="group">
                    {content}
                  </Link>
                )
              }

              return (
                <Link key={href} href={href} className="group">
                  {content}
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
            <div className="flex h-16 items-center gap-3 px-4 md:px-6">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full border border-slate-200 bg-white shadow-sm"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu className="size-5 text-slate-600" />
              </Button>

              <div className="relative" ref={orgMenuRef}>
                <Button
                  variant="outline"
                  className="flex cursor-pointer items-center gap-3 rounded-full border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                  onClick={() => setOrgMenuOpen((prev) => !prev)}
                  disabled={loadingOrganizations}
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="text-xs text-slate-400">Workspace</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {selectedOrganization?.name ?? 'All organizations'}
                    </span>
                  </div>
                  <ChevronDown className="size-4 text-slate-400" />
                </Button>
                {orgMenuOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Your organizations
                      </p>
                      <Input
                        placeholder="Search…"
                        className="mt-2 h-9 w-full rounded-lg bg-slate-50"
                        value={orgQuery}
                        onChange={(event) => setOrgQuery(event.target.value)}
                      />
                    </div>
                    <div
                      className="max-h-64 overflow-y-auto py-1"
                      data-org-list
                    >
                      {filteredOrganizations.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500">
                          {orgQuery
                            ? 'No organizations match your search.'
                            : 'You are not part of any organization yet.'}
                        </p>
                      ) : (
                        filteredOrganizations.map((org) => {
                          const membership = memberships.find(
                            (item) =>
                              item.organizationId === org.id ||
                              item.organization?.id === org.id
                          )
                          const isActive = org.id === selectedOrganizationId
                          return (
                            <button
                              key={org.id}
                              type="button"
                              data-org-item
                              data-name={org.name}
                              className={cn(
                                'flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-slate-100',
                                isActive && 'bg-slate-900/5 text-slate-900'
                              )}
                              onClick={() => setSelectedOrganizationId(org.id)}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900/10 text-sm font-semibold text-slate-700">
                                {org.name
                                  .split(' ')
                                  .map((part) => part[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <p className="font-semibold text-slate-900">
                                  {org.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {org.description || 'No description yet'}
                                </p>
                              </div>
                              <Badge tone="default" className="ml-auto">
                                {membership?.role
                                  ? membership.role.charAt(0).toUpperCase() +
                                    membership.role.slice(1)
                                  : 'Member'}
                              </Badge>
                            </button>
                          )
                        })
                      )}
                    </div>
                    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>
                          Total organizations: {organizations.length || '—'}
                        </span>
                        <span className="text-slate-400">
                          {loadingOrganizations ? 'Refreshing…' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setOrgMenuOpen(false)
                            router.push('/dashboard/organizations')
                          }}
                        >
                          Manage
                        </Button>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setOrgMenuOpen(false)
                            router.push('/dashboard/organizations/new')
                          }}
                        >
                          New
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-4">
                <div className="relative" ref={userMenuRef}>
                  <Button
                    variant="ghost"
                    className="flex cursor-pointer items-center gap-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-sm shadow-sm"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                      {initials}
                    </div>
                    <div className="hidden flex-col text-left md:flex">
                      <span className="text-sm font-semibold text-slate-900">
                        {user ? `${user.firstName} ${user.lastName}` : 'Team Flow'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {selectedMembership?.role
                          ? selectedMembership.role.charAt(0).toUpperCase() +
                            selectedMembership.role.slice(1)
                          : user?.email ?? 'team@taskflow.app'}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'size-4 text-slate-400 transition-transform',
                        userMenuOpen && 'rotate-180'
                      )}
                    />
                  </Button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
                      <div className="border-b border-slate-100 px-4 py-3 text-sm">
                        <p className="font-semibold text-slate-900">
                          {user ? `${user.firstName} ${user.lastName}` : '—'}
                        </p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <div className="flex flex-col px-1 py-1 text-sm">
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setUserMenuOpen(false)
                            router.push('/dashboard/profile')
                          }}
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-500 hover:bg-rose-50"
                          onClick={() => {
                            setUserMenuOpen(false)
                            setLogoutConfirmOpen(true)
                          }}
                        >
                          <LogOut className="size-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

            <main className="flex flex-1 flex-col px-4 pb-10 pt-6 md:px-8">
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
                {children}
              </div>
            </main>
          </div>

          <Modal
            open={logoutConfirmOpen}
            onClose={() => (isLoggingOut ? null : setLogoutConfirmOpen(false))}
            title="Sign out"
            description="Are you sure you want to sign out? You will need to enter your credentials again to access Task Flow."
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setLogoutConfirmOpen(false)}
                  disabled={isLoggingOut}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Signing out…' : 'Sign out'}
                </Button>
              </>
            }
          >
            <p className="text-sm text-slate-600">
              Signing out will close any open sessions associated with this browser.
            </p>
          </Modal>
        </div>
      </DashboardContext.Provider>
    </TaskEventContext.Provider>
  )
}
