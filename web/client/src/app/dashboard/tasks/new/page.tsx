'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { CheckSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { useDashboard } from '@/components/dashboard/dashboard-shell'
import { organizationApi, taskApi } from '@/lib/api'
import { OrganizationMember } from '@/lib/types/api'
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
import { DateTimePickerField } from '@/components/ui/date-time-picker'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(4096).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'completed', 'blocked', 'cancelled']),
  dueAt: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewTaskPage() {
  const router = useRouter()
  const { selectedOrganizationId } = useDashboard()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [creating, setCreating] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      priority: 'medium',
      status: 'open',
      dueAt: '',
    },
  })

  // Load members when organization changes
  useEffect(() => {
    if (!selectedOrganizationId) {
      setMembers([])
      return
    }
    let cancelled = false
    const loadMembers = async () => {
      try {
        const response = await organizationApi.listMembers(selectedOrganizationId)
        if (!cancelled) {
          setMembers(response.data?.items ?? [])
        }
      } catch (error) {
        if (!cancelled) {
          handleApiError({ error })
        }
      }
    }
    loadMembers()
    return () => {
      cancelled = true
    }
  }, [selectedOrganizationId])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!selectedOrganizationId) {
      toast.error('Please select an organization from the header')
      return
    }
    
    setCreating(true)
    try {
      const response = await taskApi.create({
        organizationId: selectedOrganizationId,
        title: values.title,
        description: values.description || undefined,
        assigneeId: values.assigneeId || undefined,
        priority: values.priority,
        status: values.status,
        dueAt: values.dueAt || undefined,
      })

      toast.success('Task created successfully')
      const taskId = response.data?.id
      if (taskId) {
        router.push(`/dashboard/tasks/${taskId}`)
      } else {
        router.push('/dashboard/tasks')
      }
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    } finally {
      setCreating(false)
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
            <CheckSquare className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Create task</h1>
            <p className="text-sm text-slate-500">
              Add a new task to your organization.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Task details
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Fill in the information below to create a new task.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Title *
              </label>
              <Input
                {...form.register('title')}
                placeholder="Enter task title"
              />
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
                {...form.register('description')}
                placeholder="Describe the task in detail"
                rows={4}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Assignee
                </label>
                <Select {...form.register('assigneeId')}>
                  <option value="">Unassigned</option>
                  {members.map((member) => {
                    const label = member.user
                      ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() ||
                        member.user.email ||
                        member.userId
                      : member.userId
                    return (
                      <option key={member.userId} value={member.userId}>
                        {label}
                      </option>
                    )
                  })}
                </Select>
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
                      value={field.value}
                      onChange={(newValue) => field.onChange(newValue)}
                      placeholder="Select due date"
                    />
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={creating} className="gap-2">
            <Plus className="size-4" />
            {creating ? 'Creating...' : 'Create task'}
          </Button>
        </div>
      </form>
    </div>
  )
}
