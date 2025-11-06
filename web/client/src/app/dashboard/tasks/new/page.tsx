'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckSquare } from 'lucide-react'
import * as z from 'zod'
import { toast } from 'sonner'

import { organizationApi, taskApi } from '@/lib/api'
import { Organization, OrganizationMember } from '@/lib/types/api'
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

export default function TaskCreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialOrgId = searchParams.get('orgId') ?? undefined

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: initialOrgId ?? '',
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
        const list = Array.from(unique.values())
        setOrganizations(list)
        if (!initialOrgId && list.length > 0) {
          form.setValue('organizationId', list[0].id, { shouldValidate: true })
        }
      } catch (error) {
        handleApiError({ error })
      }
    }
    fetchOrganizations()
  }, [form, initialOrgId])

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
      await taskApi.create({
        ...values,
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
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating…' : 'Create task'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
