'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Layers,
  Users,
  CalendarDays,
  BarChart2,
  Settings,
  Menu,
  Search,
  Bell,
  LogOut,
  Plus,
  Activity,
  CheckSquare,
  Clock4,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Layers, label: 'Projects', href: '/dashboard/projects' },
  { icon: Users, label: 'Teams', href: '/dashboard/teams' },
  { icon: CalendarDays, label: 'Calendar', href: '/dashboard/calendar' },
  { icon: BarChart2, label: 'Reports', href: '/dashboard/reports' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
]

const HIGHLIGHTS = [
  {
    icon: CheckSquare,
    label: 'Completed Tasks',
    balance: '+18%',
    value: '128',
    tone: 'from-emerald-500/80 to-emerald-400/60',
  },
  {
    icon: Activity,
    label: 'Active Projects',
    balance: '+5%',
    value: '12',
    tone: 'from-sky-500/80 to-sky-400/60',
  },
  {
    icon: Clock4,
    label: 'Avg. Response Time',
    balance: '-8%',
    value: '1.4h',
    tone: 'from-amber-500/80 to-amber-400/60',
  },
]

const UPCOMING = [
  {
    title: 'Design review with product',
    description: 'Prepare latest Figma prototypes and notes',
    due: 'Today • 3:00 PM',
    team: 'Product Design',
  },
  {
    title: 'Sprint planning',
    description: 'Finalize scope for sprint 18 and capacity plan',
    due: 'Tomorrow • 10:30 AM',
    team: 'Platform',
  },
  {
    title: 'Customer success sync',
    description: 'Review churn risks and onboarding feedback',
    due: 'Friday • 1:00 PM',
    team: 'Customer Success',
  },
]

const RECENT_ACTIVITY = [
  {
    title: 'New task created',
    description: 'User permissions audit for enterprise clients',
    time: '12 minutes ago',
    actor: 'Noah Sinclair',
  },
  {
    title: 'Timeline updated',
    description: 'Project Northwind launch moved to April 22',
    time: '1 hour ago',
    actor: 'Priya Patel',
  },
  {
    title: 'New comment',
    description: '“Integration tests look solid, ready for staging.”',
    time: '2 hours ago',
    actor: 'Daniel Rossi',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user, clearAuth } = useAuthStore()

  const initials = useMemo(() => {
    if (!user) return 'TF'
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  }, [user])

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Team Flow'

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error', error)
    } finally {
      clearAuth()
      toast.success('Signed out')
      router.push('/auth/login')
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={cn(
          'hidden border-r border-slate-200/80 bg-white/80 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="flex h-16 items-center border-b border-slate-200/70 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <Menu className="size-5" />
          </Button>
          {!collapsed && (
            <div className="ml-3">
              <span className="text-xs uppercase tracking-widest text-slate-400">
                Task Flow
              </span>
              <p className="text-sm font-semibold text-slate-700">Workspace</p>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href || pathname?.startsWith(`${href}/`)
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
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

        <div className="border-t border-slate-200/80 px-3 py-4">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition',
              collapsed && 'justify-center px-2'
            )}
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">{fullName}</span>
                <span className="text-xs text-slate-500">Organisation Owner</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <div className="flex flex-1 items-center gap-3">
              <div className="hidden md:block">
                <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
                <p className="text-sm text-slate-500">
                  Overview of everything in your workspace.
                </p>
              </div>
              <div className="flex flex-1 items-center gap-2 md:justify-end">
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search tasks, projects, people..."
                    className="w-64 bg-white pr-4 pl-9 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300"
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
                  className="hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-slate-500/20 transition hover:bg-slate-800 md:flex"
                >
                  <Plus className="size-4" />
                  New Task
                </Button>
                <div className="relative">
                  <button className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm shadow-sm transition hover:bg-slate-50 md:px-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                      {initials}
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm font-medium text-slate-900">{fullName}</p>
                      <p className="text-xs text-slate-500">{user?.email ?? 'team@taskflow.app'}</p>
                    </div>
                  </button>
                  <div className="absolute right-0 mt-2 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {/* Placeholder for dropdown behaviours if needed */}
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
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-8 px-4 pb-14 pt-8 md:px-8">
          {/* Highlights */}
          <section className="grid gap-4 md:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, label, value, balance, tone }) => (
              <Card
                key={label}
                className="overflow-hidden border border-white/60 bg-white/80 shadow-lg shadow-slate-200/30 backdrop-blur"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
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
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-emerald-500">{balance}</span> vs last
                    month
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
            <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Team focus
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Quick snapshot of the initiatives moving this week.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {UPCOMING.map(({ title, description, due, team }) => (
                  <div
                    key={title}
                    className="flex items-start justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <p className="text-sm text-slate-500">{description}</p>
                      <p className="text-xs text-slate-400">{team}</p>
                    </div>
                    <div className="text-xs font-medium text-slate-500">{due}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Recent activity
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  What your team has been up to in the last few hours.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {RECENT_ACTIVITY.map(({ title, description, time, actor }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                      {actor
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <p className="text-sm text-slate-500">{description}</p>
                      <p className="text-xs text-slate-400">{time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  )
}
