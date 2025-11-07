'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { taskApi } from '@/lib/api'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { useAuthStore } from '@/store/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'

const STATUS_LABELS: Record<
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

const PAGE_SIZE = 10

export default function MyTasksPage() {
  const { user } = useAuthStore()
  const { organizations } = useDashboard()
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setTasks([])
      setHasMore(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const response = await taskApi.list({
          assigneeId: user.id,
          organizationId:
            organizationFilter === 'all' ? undefined : organizationFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          page: page + 1,
          limit: PAGE_SIZE,
        })

        const payload = response.data
        const items = payload?.items ?? []
        const more = Boolean(payload?.hasMore)

        if (page > 0 && items.length === 0 && !more) {
          setPage((prev) => Math.max(0, prev - 1))
          return
        }

        if (cancelled) {
          return
        }
        setTasks(items)
        setHasMore(more)
      } catch (error) {
        handleApiError({ error })
      } finally {
        if (cancelled) {
          return
        }
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, organizationFilter, statusFilter, page])

  useEffect(() => {
    setPage(0)
  }, [organizationFilter, statusFilter, user?.id])

  const range = useMemo(() => {
    if (tasks.length === 0) {
      return { from: 0, to: 0 }
    }
    const from = page * PAGE_SIZE + 1
    const to = page * PAGE_SIZE + tasks.length
    return { from, to }
  }, [tasks.length, page])

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 text-center text-sm text-slate-500">
        Please sign in to view your tasks.
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My tasks</h1>
          <p className="text-sm text-slate-500">
            Everything assigned to you across organizations.
          </p>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Task list
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Filter by status or organization to focus on what matters.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center">
            <Select
              value={organizationFilter}
              onChange={(event) => setOrganizationFilter(event.target.value)}
              containerClassName="min-w-[200px]"
            >
              <option value="all">All organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | TaskStatus)}
              containerClassName="min-w-[180px]"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No tasks match your filters yet.
            </p>
          ) : (
            <>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Organization</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Priority</th>
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
                      <td className="py-3 pr-4 text-slate-600">
                        {task.organization?.name ?? '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_LABELS[task.status].tone}>
                          {STATUS_LABELS[task.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={PRIORITY_LABELS[task.priority].tone}>
                          {PRIORITY_LABELS[task.priority].label}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/tasks/${task.id}`}>
                              Open
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length > 0 && (page > 0 || hasMore) && (
                <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                  <p>
                    Showing {range.from}–{range.to}
                    {hasMore ? ' (more available)' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-xs font-medium text-slate-600">
                      Page {page + 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
