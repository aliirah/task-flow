'use client'

import { ReactNode } from 'react'
import {
  Activity,
  CheckSquare,
  LayoutDashboard,
  Layers,
  Menu,
  UserCheck,
} from 'lucide-react'

import { TaskEventContext } from '@/hooks/useTaskEvents'
import { CommentEventContext } from '@/hooks/useCommentEvents'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { DashboardSidebar, MobileSidebar } from '@/components/dashboard/sidebar'
import { OrganizationSwitcher } from '@/components/dashboard/organization-switcher'
import { UserMenu } from '@/components/dashboard/user-menu'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { DashboardContext } from '@/components/dashboard/context'
import { useDashboardShellLogic } from '@/components/dashboard/use-dashboard-shell'

export { useDashboard } from '@/components/dashboard/context'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Layers, label: 'Organizations', href: '/dashboard/organizations' },
  { icon: CheckSquare, label: 'Tasks', href: '/dashboard/tasks' },
  { icon: UserCheck, label: 'My Tasks', href: '/dashboard/my-tasks' },
  { icon: Activity, label: 'Profile', href: '/dashboard/profile' },
]

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const {
    contextValue,
    taskEventContextValue,
    commentEventContextValue,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    orgMenuOpen,
    setOrgMenuOpen,
    userMenuOpen,
    setUserMenuOpen,
    orgQuery,
    setOrgQuery,
    orgMenuRef,
    userMenuRef,
    loadingOrganizations,
    filteredOrganizations,
    memberships,
    selectedOrganization,
    selectedOrganizationId,
    selectedMembership,
    handleLogout,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    isLoggingOut,
    initials,
    setSelectedOrganizationId,
    user,
    currentPath,
    router,
  } = useDashboardShellLogic()

  return (
    <TaskEventContext.Provider value={taskEventContextValue}>
      <CommentEventContext.Provider value={commentEventContextValue}>
        <DashboardContext.Provider value={contextValue}>
          <div className="flex min-h-screen bg-slate-50">
          <DashboardSidebar
            collapsed={sidebarCollapsed}
            pathname={currentPath}
            items={NAV_ITEMS}
            onNavigate={() => setMobileSidebarOpen(false)}
          />

          <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
              <div className="flex h-16 items-center gap-3 px-4 md:px-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full border border-slate-200 bg-white shadow-sm md:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5 text-slate-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden rounded-full border border-slate-200 bg-white shadow-sm md:inline-flex"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <Menu className="size-5 text-slate-600" />
                </Button>

                <OrganizationSwitcher
                  ref={orgMenuRef}
                  open={orgMenuOpen}
                  loading={loadingOrganizations}
                  selectedOrganization={selectedOrganization}
                  selectedOrganizationId={selectedOrganizationId}
                  organizations={filteredOrganizations}
                  memberships={memberships}
                  query={orgQuery}
                  onQueryChange={setOrgQuery}
                  onToggle={() => setOrgMenuOpen((prev) => !prev)}
                  onClose={() => setOrgMenuOpen(false)}
                  onSelect={setSelectedOrganizationId}
                  onManage={() => router.push('/dashboard/organizations')}
                  onCreate={() => router.push('/dashboard/organizations/new')}
                />

                <div className="ml-auto flex items-center gap-2">
                  <NotificationBell />
                  <UserMenu
                    ref={userMenuRef}
                    open={userMenuOpen}
                    user={user}
                    initials={initials}
                    membershipRole={selectedMembership?.role}
                    onToggle={() => setUserMenuOpen((prev) => !prev)}
                    onProfile={() => {
                      setUserMenuOpen(false)
                      router.push('/dashboard/profile')
                    }}
                    onSignOut={() => {
                      setUserMenuOpen(false)
                      setLogoutConfirmOpen(true)
                    }}
                  />
                </div>
              </div>
            </header>

            <main className="flex flex-1 flex-col overflow-x-hidden px-4 pb-10 pt-6 md:px-8">
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
                {children}
              </div>
            </main>
          </div>

          <MobileSidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}>
            <DashboardSidebar
              collapsed={false}
              pathname={currentPath}
              items={NAV_ITEMS}
              onNavigate={() => setMobileSidebarOpen(false)}
              mobile
            />
          </MobileSidebar>
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
              <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
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
      </CommentEventContext.Provider>
    </TaskEventContext.Provider>
  )
}
