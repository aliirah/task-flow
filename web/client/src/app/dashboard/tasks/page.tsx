'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { organizationApi, taskApi } from '@/lib/api'
import { Task, TaskStatus, OrganizationMember } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { createMyTaskColumns } from '@/components/tasks/task-columns'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import { useTableState } from '@/hooks/use-table-state'
import type { TaskEventMessage } from '@/lib/types/ws'
import { taskEventToTask } from '@/lib/utils/task-events'

const PAGE_SIZE = 10

function TasksPageContent() {
  const {
    selectedOrganization,
    selectedOrganizationId,
  } = useDashboard()

  const { sorting, search, debouncedSearch, setSorting, setSearch } = useTableState({
    storageKey: 'tasks-table-state',
    enablePersistence: true,
  })

  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [page, setPage] = useState(0)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const handleLocalTaskUpdate = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      )
    },
    []
  )

  useEffect(() => {
    if (!selectedOrganizationId) {
      setMembers([])
      setTasks([])
      setHasMore(false)
      return
    }
    const fetchMembers = async () => {
      try {
        const response = await organizationApi.listMembers(selectedOrganizationId)
        setMembers(response.data?.items ?? [])
      } catch (error) {
        handleApiError({ error })
      }
    }
    fetchMembers()
  }, [selectedOrganizationId])

  const fetchTasks = useCallback(async () => {
    if (!selectedOrganizationId) {
      setTasks([])
      setHasMore(false)
      return
    }
    setLoadingTasks(true)
    try {
      const response = await taskApi.list({
        organizationId: selectedOrganizationId,
        page: page + 1,
        limit: PAGE_SIZE,
        status: filter === 'all' ? undefined : filter,
        sortBy: sorting.length > 0 ? sorting[0].id : undefined,
        sortOrder: sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
        search: debouncedSearch || undefined,
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
  }, [selectedOrganizationId, page, filter, sorting, debouncedSearch])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    setPage(0)
  }, [filter, selectedOrganizationId, sorting, debouncedSearch])

  useTaskEvents(
    useCallback(
      (event: TaskEventMessage) => {
        if (!selectedOrganizationId) return
        if (event.data.organizationId !== selectedOrganizationId) {
          return
        }
        const incomingTask = taskEventToTask(event)
        const matchesFilter = filter === 'all' || incomingTask.status === filter
        let insertedToPage = false

        setTasks((current) => {
          const index = current.findIndex((task) => task.id === incomingTask.id)
          if (index >= 0) {
            if (!matchesFilter) {
              const next = current.slice()
              next.splice(index, 1)
              return next
            }
            const next = current.slice()
            next[index] = { ...next[index], ...incomingTask }
            return next
          }
          if (event.type === 'task.event.created' && matchesFilter && page === 0) {
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
      [selectedOrganizationId, filter, page]
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

  const taskColumns = useMemo(
    () =>
      createMyTaskColumns({
        onTaskUpdate: handleLocalTaskUpdate,
        onTaskDelete: (task) => setTaskToDelete(task),
        assigneeOptions: members,
      }),
    [handleLocalTaskUpdate, members]
  )

  const handleDeleteTask = async () => {
    if (!taskToDelete) return
    try {
      setDeleteLoading(true)
      await taskApi.remove(taskToDelete.id)
      toast.success('Task deleted')
      setTaskToDelete(null)
      await fetchTasks()
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">
            View and manage tasks for your active organization.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 shadow-sm">
            {selectedOrganization
              ? selectedOrganization.name
              : 'Select an organization from the header'}
          </div>
          <Button
            asChild
            disabled={!selectedOrganizationId}
            className="gap-2"
          >
            <Link href="/dashboard/tasks/new">
              <Plus className="size-4" />
              New task
            </Link>
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
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
        <CardContent>
          {!selectedOrganizationId ? (
            <p className="py-6 text-sm text-slate-500">
              Choose an organization to see its tasks.
            </p>
          ) : loadingTasks ? (
            <p className="py-6 text-sm text-slate-500">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              Nothing here yet. Create your first task for this organization.
            </p>
          ) : (
            <>
              <DataTable
                columns={taskColumns}
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

      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => (deleteLoading ? null : setTaskToDelete(null))}
        title="Delete task"
        description="Are you sure you want to permanently delete this task?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setTaskToDelete(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleDeleteTask}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will remove <strong>{taskToDelete?.title}</strong> and any related
          comments or updates.
        </p>
      </Modal>
    </>
  )
}

export default function TasksPage() {
  return <TasksPageContent />
}
