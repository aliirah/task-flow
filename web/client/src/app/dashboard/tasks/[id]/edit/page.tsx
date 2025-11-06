'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckSquare, Trash2 } from 'lucide-react'
import * as z from 'zod'
import { toast } from 'sonner'

import { organizationApi, taskApi } from '@/lib/api'
import {
  Organization,
  OrganizationMember,
  Task,
  TaskPriority,
  TaskStatus,
} from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'

const schema = z.object({
  organizationId: z.string().uuid('Select an organization'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(4096).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'completed', 'blocked', 'cancelled']),
  dueAt: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TaskEditPageProps {
  params: { id: string }
}

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function TaskEditPage({ params }: TaskEditPageProps) {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [task, setTask] = useState<Task | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: '',
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      dueAt: '',
    },
  })

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizationApi.listMine()
        const unique = new Map<string, Organization>()
        ;(response.data?.items ?? []).forEach((membership) => {
          if (membership.organization) {
            unique.set(membership.organization.id, membership.organization)
          }
        })
        setOrganizations(Array.from(unique.values()))
      } catch (error) {
        handleApiError({ error })
      }
    }
    fetchOrganizations()
  }, [])

  useEffect(() => {
    const fetchTask = async () => {
      setLoading(true)
      try {
        const response = await taskApi.get(params.id)
        const current = response.data
        if (!current) {
          setTask(null)
          return
        }
        setTask(current)
        if (current.organization && current.organization.id) {
          setOrganizations((prev) => {
            if (prev.some((org) => org.id === current.organization!.id)) {
              return prev
            }
            return [...prev, current.organization!]
          })
        }
        form.reset({
          organizationId: current.organizationId,
          title: current.title,
          description: current.description ?? '',
          assigneeId: current.assigneeId ?? '',
          priority: current.priority as TaskPriority,
          status: current.status as TaskStatus,
          dueAt: toLocalDateTimeInput(current.dueAt),
        })

        if (current.organizationId) {
          const membersResponse = await organizationApi.listMembers(
            current.organizationId
          )
          setMembers(membersResponse.data?.items ?? [])
        }
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    fetchTask()
  }, [params.id, form])

  const organizationId = useWatch({
    control: form.control,
    name: 'organizationId',
  })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!organizationId) {
        await Promise.resolve()
        if (!cancelled) {
          setMembers([])
        }
        return
      }
      try {
        const response = await organizationApi.listMembers(organizationId)
        if (!cancelled) {
          setMembers(response.data?.items ?? [])
        }
      } catch (error) {
        handleApiError({ error })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await taskApi.update(params.id, {
        ...values,
        assigneeId: values.assigneeId || undefined,
        dueAt: values.dueAt
          ? new Date(values.dueAt).toISOString()
          : undefined,
      })
      toast.success('Task updated')
      router.push(`/dashboard/tasks?orgId=${values.organizationId}`)
      router.refresh()
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  const onDelete = async () => {
    if (!task) return
    try {
      setDeleting(true)
      await taskApi.remove(task.id)
      toast.success('Task deleted')
      router.push(`/dashboard/tasks?orgId=${task.organizationId}`)
      router.refresh()
    } catch (error) {
      handleApiError({ error })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
          <CheckSquare className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Edit task
          </h1>
          <p className="text-sm text-slate-500">
            Adjust ownership, expectations, or scheduling for this task.
          </p>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Task details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Keep teammates aligned with the latest information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !task ? (
            <p className="text-sm text-slate-500">
              Task not found or no longer accessible.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-6">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Organization
                </label>
                <Select
                  value={organizationId ?? ''}
                  onChange={(event) =>
                    form.setValue('organizationId', event.target.value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.organizationId && (
                  <p className="text-xs text-rose-500">
                    {form.formState.errors.organizationId.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Title
                </label>
                <Input placeholder="Title" {...form.register('title')} />
                {form.formState.errors.title && (
                  <p className="text-xs text-rose-500">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <Textarea
                  placeholder="Add context, acceptance criteria, or links…"
                  {...form.register('description')}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Assignee
                  </label>
                  <Select {...form.register('assigneeId')}>
                    <option value="">Unassigned</option>
                    {members.map((member) =>
                      member.user ? (
                        <option key={member.userId} value={member.userId}>
                          {member.user.firstName} {member.user.lastName}
                        </option>
                      ) : null
                    )}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Priority
                  </label>
                  <Select {...form.register('priority')}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <Select {...form.register('status')}>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Due date
                  </label>
                  <Input type="datetime-local" {...form.register('dueAt')} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-rose-500 hover:text-rose-600"
                  onClick={onDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
