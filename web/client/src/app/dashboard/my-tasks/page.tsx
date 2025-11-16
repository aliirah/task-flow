'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'

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
import { HierarchicalTaskList } from '@/components/tasks/hierarchical-task-list'
import { createTaskColumns } from '@/components/tasks/task-columns'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import { useTableState } from '@/hooks/use-table-state'
import type { TaskEventMessage } from '@/lib/types/ws'
import { taskEventToTask } from '@/lib/utils/task-events'

const PAGE_SIZE = 10

export default function MyTasksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading tasks…</div>}>
      <MyTasksPageContent />
    </Suspense>
  )
}

function MyTasksPageContent() {
  const { user } = useAuthStore()
  const [viewMode, setViewMode] = useState<'table' | 'hierarchical'>('table')
  const [viewModeHydrated, setViewModeHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('tasks-view-mode')
    if (stored) {
      setViewMode(stored as 'table' | 'hierarchical')
    }
    setViewModeHydrated(true)
  }, [])

  useEffect(() => {
    if (viewModeHydrated) {
      localStorage.setItem('tasks-view-mode', viewMode)
    }
  }, [viewMode, viewModeHydrated])

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

  const filterProp = useMemo(
    () => ({
      search,
      setSearch,
    }),
    [search, setSearch]
  )

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 text-center text-sm text-slate-500">
        Please sign in to view your tasks.
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-2 py-10 md:px-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My tasks</h1>
          <p className="text-sm text-slate-500">
            Everything assigned to you across organizations.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
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
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Table view"
                >
                  <List className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode('hierarchical')}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'hierarchical'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Hierarchical view"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
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
            {viewMode === 'table' ? (
              <DataTable
              columns={columns}
              data={tasks}
              loading={loading}
                  searchKey="title"
                  searchPlaceholder="Search tasks..."
                  manualSorting
                  manualFiltering
                  sorting={sorting}
                  onSortingChange={setSorting}
                  filter={filterProp}
                  hidePagination
                  emptyMessage={
                    tasks.length === 0 && !search
                      ? 'No tasks match your filters yet.'
                      : undefined
                  }
                />
              ) : loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  {!search ? 'No tasks match your filters yet.' : 'No matching tasks found.'}
                </div>
              ) : (
                <HierarchicalTaskList
                  tasks={tasks}
                  onTasksChange={setTasks}
                  onTaskClick={(task) => window.location.href = `/dashboard/tasks/${task.id}`}
                  onDeleteTask={() => {}}
                  organizationId={''}
                />
              )}
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
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
