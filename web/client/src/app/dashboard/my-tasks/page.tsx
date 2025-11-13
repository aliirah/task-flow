'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { taskApi } from '@/lib/api'
import type { Task, TaskStatus } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { createTaskColumns } from '@/components/tasks/task-columns'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import { useTableState } from '@/hooks/use-table-state'
import type { TaskEventMessage } from '@/lib/types/ws'
import { taskEventToTask } from '@/lib/utils/task-events'

const PAGE_SIZE = 10

export default function MyTasksPage() {
  const { user } = useAuthStore()
  const { sorting, search, debouncedSearch, setSorting, setSearch } = useTableState({
    storageKey: 'my-tasks-table-state',
    enablePersistence: true,
  })

  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const handleInlineUpdate = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      )
    },
    []
  )

  const fetchMyTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([])
      setHasMore(false)
      return
    }
    setLoading(true)
    try {
      const response = await taskApi.list({
        assigneeId: user.id,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: page + 1,
        limit: PAGE_SIZE,
        sortBy: sorting.length > 0 ? sorting[0].id : undefined,
        sortOrder: sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
        search: debouncedSearch || undefined,
      })

      const payload = response.data
      const items = payload?.items ?? []
      const more = Boolean(payload?.hasMore)

      if (page > 0 && items.length === 0 && !more) {
        setPage((prev) => Math.max(0, prev - 1))
        return
      }

      setTasks(items)
      setHasMore(more)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoading(false)
    }
  }, [user?.id, statusFilter, page, sorting, debouncedSearch])

  useEffect(() => {
    fetchMyTasks()
  }, [fetchMyTasks])

  useEffect(() => {
    setPage(0)
  }, [statusFilter, user?.id, sorting, debouncedSearch])

  useTaskEvents(
    useCallback(
      (event: TaskEventMessage) => {
        if (!user?.id) return
        const incomingTask = taskEventToTask(event)
        const matchesFilter =
          statusFilter === 'all' || incomingTask.status === statusFilter
        const assignedToUser = incomingTask.assigneeId === user.id
        let insertedToPage = false

        setTasks((current) => {
          const index = current.findIndex((task) => task.id === incomingTask.id)
          if (index >= 0) {
            if (!assignedToUser || !matchesFilter) {
              const next = current.slice()
              next.splice(index, 1)
              return next
            }
            const next = current.slice()
            next[index] = { ...next[index], ...incomingTask }
            return next
          }
          if (assignedToUser && matchesFilter && page === 0) {
            const next = [incomingTask, ...current]
            if (next.length > PAGE_SIZE) {
              insertedToPage = true
              return next.slice(0, PAGE_SIZE)
            }
            return next
          }
          return current
        })

        if (insertedToPage) {
          setHasMore(true)
        }
      },
      [user?.id, statusFilter, page]
    )
  )

  const range = useMemo(() => {
    if (tasks.length === 0) {
      return { from: 0, to: 0 }
    }
    const from = page * PAGE_SIZE + 1
    const to = page * PAGE_SIZE + tasks.length
    return { from, to }
  }, [tasks.length, page])

  const columns = useMemo(
    () =>
      createTaskColumns({
        onTaskUpdate: handleInlineUpdate,
      }),
    [handleInlineUpdate]
  )

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

      <Card className="overflow-hidden border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Task list
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Filter by status to focus on what matters.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center">
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
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No tasks match your filters yet.
            </p>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={tasks}
                searchKey="title"
                searchPlaceholder="Search tasks..."
                manualSorting
                manualFiltering
                sorting={sorting}
                search={search}
                onSortingChange={setSorting}
                onSearchChange={setSearch}
                hidePagination
              />
              {(page > 0 || hasMore) && (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
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
