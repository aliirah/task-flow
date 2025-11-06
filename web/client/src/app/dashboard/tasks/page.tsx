'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { organizationApi, taskApi } from '@/lib/api'
import { Organization, Task, TaskPriority, TaskStatus } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export default function TasksIndexPage() {
  const searchParams = useSearchParams()
  const initialOrgId = searchParams.get('orgId') ?? undefined

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(
    initialOrgId
  )
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    const fetchMemberships = async () => {
      setLoading(true)
      try {
        const response = await organizationApi.listMine()
        const items = response.data?.items ?? []
        const unique = new Map<string, Organization>()
        items.forEach((membership) => {
          if (membership.organization) {
            unique.set(membership.organization.id, membership.organization)
          }
        })
        const available = Array.from(unique.values())
        setOrganizations(available)

        if (!initialOrgId && available.length > 0) {
          setSelectedOrgId(available[0].id)
        } else if (
          initialOrgId &&
          available.every((org) => org.id !== initialOrgId)
        ) {
          setSelectedOrgId(available[0]?.id)
        }
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    fetchMemberships()
  }, [initialOrgId])

  useEffect(() => {
    if (!selectedOrgId) {
      setTasks([])
      setHasMore(false)
      return
    }
    const fetchTasks = async () => {
      setLoadingTasks(true)
      try {
        const response = await taskApi.list({
          organizationId: selectedOrgId,
          page: page + 1,
          limit: PAGE_SIZE,
          status: filter === 'all' ? undefined : filter,
        })
        const payload = response.data
        const items = payload?.items ?? []
        const more = Boolean(payload?.hasMore)

        if (page > 0 && items.length === 0 && !more) {
          setPage((prev) => Math.max(0, prev - 1))
          setTasks([])
          setHasMore(false)
          return
        }

        setTasks(items)
        setHasMore(more)
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoadingTasks(false)
      }
    }
    fetchTasks()
  }, [selectedOrgId, page, filter])

  useEffect(() => {
    setPage(0)
  }, [filter, selectedOrgId])

  const range = useMemo(() => {
    if (tasks.length === 0) {
      return { from: 0, to: 0 }
    }
    const from = page * PAGE_SIZE + 1
    const to = page * PAGE_SIZE + tasks.length
    return { from, to }
  }, [tasks.length, page])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">
            View and manage tasks across your organizations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedOrgId}
            onChange={(event) => setSelectedOrgId(event.target.value || undefined)}
          >
            <option value="">Select organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
          <Button
            asChild
            disabled={!selectedOrgId}
            className="gap-2"
          >
            <Link
              href={
                selectedOrgId
                  ? `/dashboard/tasks/new?orgId=${selectedOrgId}`
                  : '/dashboard/tasks/new'
              }
            >
              <Plus className="size-4" />
              New task
            </Link>
          </Button>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Task list
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Use filters to focus on a specific status or assignee.
            </CardDescription>
          </div>
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value as 'all' | TaskStatus)}
            containerClassName="min-w-[180px] max-w-[220px]"
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
          {!selectedOrgId ? (
            <p className="py-6 text-sm text-slate-500">
              Choose an organization to see its tasks.
            </p>
          ) : loading || loadingTasks ? (
            <p className="py-6 text-sm text-slate-500">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              Nothing here yet. Create your first task for this organization.
            </p>
          ) : (
            <>
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
                        <p className="font-medium text-slate-900">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-slate-500">
                            {task.description}
                          </p>
                        )}
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
                      <td className="py-3 pr-4 text-slate-600">
                        {task.assignee
                          ? `${task.assignee.firstName} ${task.assignee.lastName}`
                          : 'Unassigned'}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {task.dueAt
                          ? new Date(task.dueAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="link" size="sm" asChild>
                          <Link href={`/dashboard/tasks/${task.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
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
