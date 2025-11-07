'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckSquare, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { taskApi } from '@/lib/api'
import type { Task } from '@/lib/types/api'
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
import { Modal } from '@/components/ui/modal'

interface TaskDetailPageProps {
  params: { id: string }
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
}

export default function TaskDetailPage({ params }: TaskDetailPageProps) {
  const router = useRouter()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const fetchTask = async () => {
      setLoading(true)
      try {
        const response = await taskApi.get(params.id)
        setTask(response.data ?? null)
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    fetchTask()
  }, [params.id])

  const handleDelete = async () => {
    if (!task) return
    try {
      setDeleteLoading(true)
      await taskApi.remove(task.id)
      toast.success('Task deleted')
      router.push(`/dashboard/tasks${task.organizationId ? `?orgId=${task.organizationId}` : ''}`)
      router.refresh()
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleteLoading(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
            <CheckSquare className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {task?.title ?? 'Task'}
            </h1>
            <p className="text-sm text-slate-500">
              Detailed view of this task.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/dashboard/tasks${
                  task?.organizationId ? `?orgId=${task.organizationId}` : ''
                }`
              )
            }
          >
            Back to tasks
          </Button>
          <Button
            variant="ghost"
            className="gap-2"
            asChild
            disabled={!task}
          >
            <Link href={`/dashboard/tasks/${params.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setDeleteOpen(true)}
            disabled={!task}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Task information
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Status, ownership, and important dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading task…</p>
          ) : !task ? (
            <p className="text-sm text-rose-500">Task not found.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="info">
                  {STATUS_LABELS[task.status] ?? task.status}
                </Badge>
                <Badge tone="default">{task.priority ?? 'medium'}</Badge>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">
                  Description
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {task.description || 'No description provided.'}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">Assignee</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {task.assignee
                      ? `${task.assignee.firstName} ${task.assignee.lastName}`
                      : task.assigneeId || 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Reporter</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {task.reporter
                      ? `${task.reporter.firstName} ${task.reporter.lastName}`
                      : task.reporterId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Due date</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Created at
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {task.createdAt
                      ? new Date(task.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Updated at
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {task.updatedAt
                      ? new Date(task.updatedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => (deleteLoading ? null : setDeleteOpen(false))}
        title="Delete task"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[120px]"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete {task?.title ?? 'this task'}?
        </p>
      </Modal>
    </div>
  )
}
