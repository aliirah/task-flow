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
  Settings,
  UserCircle,
} from 'lucide-react'

import { authApi, organizationApi } from '@/lib/api'
import type { Organization, OrganizationMember } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/store/auth'

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
  { icon: Activity, label: 'Profile', href: '/dashboard/profile' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
]

const STORAGE_KEY = 'dashboard:selected-org'

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearAuth } = useAuthStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const orgMenuRef = useRef<HTMLDivElement | null>(null)
  const storedOrgRef = useRef<string | null>(null)

  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<
    string | null
  >(null)
  const [selectionHydrated, setSelectionHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    storedOrgRef.current = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshOrganizations = useCallback(async () => {
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
  }, [])

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

  const setSelectedOrganizationId = useCallback(
    (orgId: string | null) => {
      if (orgId && !organizations.some((org) => org.id === orgId)) {
        return
      }
      setSelectedOrganizationIdState(orgId)
      setOrgMenuOpen(false)
    },
    [organizations]
  )

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  )

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
      await authApi.logout()
    } catch (error) {
      console.error('logout failed', error)
    } finally {
      clearAuth()
      setIsLoggingOut(false)
      setLogoutConfirmOpen(false)
      router.replace('/auth/login')
      router.refresh()
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

  return (
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
              const isActive =
                pathname === href || pathname?.startsWith(`${href}/`)
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
                className="md:hidden"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
              >
                <Menu className="size-5" />
              </Button>

              <div className="relative" ref={orgMenuRef}>
                <Button
                  variant="outline"
                  className="flex cursor-pointer items-center gap-2 rounded-full border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
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
                        onChange={(event) => {
                          const value = event.target.value.toLowerCase()
                          const container = orgMenuRef.current?.querySelector(
                            '[data-org-list]'
                          )
                          if (!container) return
                          const items =
                            container.querySelectorAll<HTMLButtonElement>(
                              '[data-org-item]'
                            )
                          items.forEach((item) => {
                            const match = item.dataset.name
                              ?.toLowerCase()
                              .includes(value)
                            item.style.display = match ? 'flex' : 'none'
                          })
                        }}
                      />
                    </div>
                    <div
                      className="max-h-64 overflow-y-auto py-1"
                      data-org-list
                    >
                      {organizations.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500">
                          You&apos;re not part of any organization yet.
                        </p>
                      ) : (
                        organizations.map((org) => {
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
                              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900/10 text-sm font-semibold text-slate-700">
                                {org.name
                                  .split(' ')
                                  .map((part) => part[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {org.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {membership?.role
                                    ? membership.role.charAt(0).toUpperCase() +
                                      membership.role.slice(1)
                                    : 'Member'}
                                </p>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                      <span>
                        Total organizations: {organizations.length || '—'}
                      </span>
                      <button
                        type="button"
                        className="text-slate-700 underline"
                        onClick={() => {
                          setOrgMenuOpen(false)
                          router.push('/dashboard/organizations/new')
                        }}
                      >
                        New
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant="ghost"
                  className="hidden cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-sm shadow-sm md:flex"
                  onClick={() => router.push('/dashboard/profile')}
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                    {initials}
                  </div>
                  <div className="flex flex-col items-start text-left">
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
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-slate-500 hover:text-slate-900"
                  onClick={() => router.push('/dashboard/profile')}
                >
                  <UserCircle className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-slate-500 hover:text-slate-900"
                  onClick={() => setLogoutConfirmOpen(true)}
                >
                  <LogOut className="size-5" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex flex-1 flex-col px-4 pb-10 pt-6 md:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
              {children}
            </div>
          </main>
        </div>
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
    </DashboardContext.Provider>
  )
}
