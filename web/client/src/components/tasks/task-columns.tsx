'use client'

import Link from 'next/link'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Trash2 } from 'lucide-react'

import { Task, OrganizationMember, User } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import {
  TaskStatusInlineSelect,
  TaskPriorityInlineSelect,
  TaskAssigneeInlineSelect,
} from '@/components/tasks/task-inline-controls'

type AssigneeOption = {
  value: string
  label: string
  user?: User
}

interface TaskColumnContext {
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void
  onTaskDelete?: (task: Task) => void
  assigneeOptions?: OrganizationMember[]
  organizationId?: string
}

const convertMembersToOptions = (members: OrganizationMember[]): AssigneeOption[] => {
  return members.map((member) => {
    const label = member.user
      ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() ||
        member.user.email ||
        member.userId
      : member.userId
    return {
      value: member.userId,
      label,
      user: member.user,
    }
  })
}

const formatAssignee = (task: Task): string => {
  if (task.assignee) {
    return (
      `${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim() ||
      task.assignee.email ||
      task.assigneeId ||
      'Unassigned'
    )
  }
  return task.assigneeId || 'Unassigned'
}

export const createTaskColumns = (
  context: TaskColumnContext = {}
): ColumnDef<Task>[] => {
  const { onTaskUpdate, onTaskDelete, assigneeOptions, organizationId } = context

  return [
    {
      accessorKey: 'title',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 text-xs uppercase text-slate-500 hover:bg-transparent hover:text-slate-900"
          >
            Title
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original
        return (
          <div>
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {task.title}
            </Link>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: () => <span className="text-xs uppercase text-slate-500">Status</span>,
      cell: ({ row }) => {
        const task = row.original
        return (
          <TaskStatusInlineSelect
            taskId={task.id}
            value={task.status}
            onUpdated={(nextStatus) =>
              onTaskUpdate?.(task.id, { status: nextStatus })
            }
            className="min-w-[140px] text-xs"
          />
        )
      },
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 text-xs uppercase text-slate-500 hover:bg-transparent hover:text-slate-900"
          >
            Priority
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original
        return (
          <TaskPriorityInlineSelect
            taskId={task.id}
            value={task.priority}
            onUpdated={(nextPriority) =>
              onTaskUpdate?.(task.id, { priority: nextPriority })
            }
            className="min-w-[130px] text-xs"
          />
        )
      },
    },
    {
      accessorKey: 'assigneeId',
      header: () => <span className="text-xs uppercase text-slate-500">Assignee</span>,
      cell: ({ row }) => {
        const task = row.original
        
        // If we have assigneeOptions, use them
        if (assigneeOptions) {
          const options = convertMembersToOptions(assigneeOptions)
          return (
            <TaskAssigneeInlineSelect
              taskId={task.id}
              value={task.assigneeId ?? ''}
              options={options}
              fallbackLabel={formatAssignee(task)}
              onUpdated={(nextId, user) =>
                onTaskUpdate?.(task.id, {
                  assigneeId: nextId || undefined,
                  assignee: user ?? (nextId ? task.assignee : undefined),
                })
              }
              className="min-w-[150px] text-xs"
            />
          )
        }
        
        // If we have organizationId, fetch options dynamically
        if (organizationId) {
          return (
            <TaskAssigneeInlineSelect
              taskId={task.id}
              value={task.assigneeId ?? ''}
              organizationId={organizationId}
              fallbackLabel={formatAssignee(task)}
              onUpdated={(nextId, user) =>
                onTaskUpdate?.(task.id, {
                  assigneeId: nextId || undefined,
                  assignee: user ?? (nextId ? task.assignee : undefined),
                })
              }
              className="min-w-[150px] text-xs"
            />
          )
        }
        
        // Fallback to display only
        return (
          <span className="text-sm text-slate-600">
            {formatAssignee(task)}
          </span>
        )
      },
    },
    {
      id: 'organization',
      accessorKey: 'organization',
      header: () => <span className="text-xs uppercase text-slate-500">Organization</span>,
      cell: ({ row }) => {
        const task = row.original
        return (
          <span className="text-slate-600">
            {task.organization?.name ?? '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'dueAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 text-xs uppercase text-slate-500 hover:bg-transparent hover:text-slate-900"
          >
            Due
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original
        return (
          <span className="text-slate-500">
            {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="text-xs uppercase text-slate-500">Actions</span>,
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex justify-end gap-2">
            {onTaskDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-rose-400 hover:text-rose-600"
                onClick={() => onTaskDelete(task)}
                aria-label="Delete task"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/tasks/${task.id}`}>Open</Link>
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}

// Variant for minimal columns (e.g., My Tasks page without organization column)
export const createMyTaskColumns = (
  context: TaskColumnContext = {}
): ColumnDef<Task>[] => {
  const columns = createTaskColumns(context)
  // Remove organization column
  return columns.filter((col) => col.id !== 'organization')
}
