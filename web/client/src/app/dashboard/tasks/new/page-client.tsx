'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckSquare } from 'lucide-react'
import * as z from 'zod'
import { toast } from 'sonner'

import { organizationApi, taskApi } from '@/lib/api'
import { OrganizationMember, TaskPriority, TaskStatus } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { useDashboard } from '@/components/dashboard/dashboard-shell'
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
import { DateTimePickerField } from '@/components/ui/date-time-picker'
import {
  AssigneeSearchSelect,
  PriorityBadgeSelect,
  StatusBadgeSelect,
  TaskTypeToggle,
  buildAssigneeOptions,
} from '@/components/tasks/task-form-controls'

const schema = z.object({
  organizationId: z.string().uuid('Select an organization'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(4096).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'completed', 'blocked', 'cancelled']),
  type: z.enum(['task', 'story']),
  dueAt: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function TaskCreatePageClient() {
  const router = useRouter()
  const { selectedOrganizationId, selectedOrganization } = useDashboard()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: '',
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      type: 'task',
      dueAt: '',
    },
  })

  useEffect(() => {
    if (selectedOrganizationId) {
      form.setValue('organizationId', selectedOrganizationId, { shouldValidate: true })
    } else {
      form.setValue('organizationId', '', { shouldValidate: true })
      setMembers([])
    }
  }, [selectedOrganizationId, form])

  const organizationId = useWatch({
    control: form.control,
    name: 'organizationId',
  })

  const assigneeOptions = useMemo(() => buildAssigneeOptions(members), [members])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!organizationId) {
        if (!cancelled) {
          setMembers([])
          setLoadingMembers(false)
        }
        return
      }
      setLoadingMembers(true)
      try {
        const response = await organizationApi.listMembers(organizationId)
        if (!cancelled) {
          setMembers(response.data?.items ?? [])
        }
      } catch (error) {
        handleApiError({ error })
      } finally {
        if (!cancelled) {
          setLoadingMembers(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!selectedOrganizationId) {
      toast.error('Select an organization to create tasks.')
      return
    }
    try {
      await taskApi.create({
        ...values,
        organizationId: selectedOrganizationId,
        assigneeId: values.assigneeId || undefined,
        dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
      })
      toast.success('Task created')
      router.push(`/dashboard/tasks?orgId=${values.organizationId}`)
      router.refresh()
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
          <CheckSquare className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Create task
          </h1>
          <p className="text-sm text-slate-500">
            Track the work that matters to this organization.
          </p>
          <p className="text-xs text-slate-400">
            {selectedOrganization
              ? `Working in ${selectedOrganization.name}`
              : 'Select an organization from the header to create tasks.'}
          </p>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Task details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Assign ownership and set expectations for this task.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-6">
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
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <TaskTypeToggle
                  value={(field.value as 'task' | 'story') ?? 'task'}
                  onChange={(value) => field.onChange(value)}
                />
              )}
            />
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Status
                </label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <StatusBadgeSelect
                      value={field.value as TaskStatus}
                      onSelect={(value) => field.onChange(value)}
                    />
                  )}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Priority
                </label>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <PriorityBadgeSelect
                      value={field.value as TaskPriority}
                      onSelect={(value) => field.onChange(value)}
                    />
                  )}
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Assignee
                </label>
                <Controller
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <AssigneeSearchSelect
                      value={field.value || ''}
                      options={assigneeOptions}
                      loading={loadingMembers}
                      onSelect={(option) => field.onChange(option.value)}
                    />
                  )}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Due date
                </label>
                <Controller
                  control={form.control}
                  name="dueAt"
                  render={({ field }) => (
                    <DateTimePickerField
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Select a date"
                    />
                  )}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={form.formState.isSubmitting || !selectedOrganizationId}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || !selectedOrganizationId
                }
              >
                {form.formState.isSubmitting ? 'Creating…' : 'Create task'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
