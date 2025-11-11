'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Users, UserPlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { organizationApi } from '@/lib/api'
import type { Organization, OrganizationMember, User } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { UserEmailSelect } from '@/components/organizations/user-email-select'
import { Select } from '@/components/ui/select'
import { useAuthStore } from '@/store/auth'

const memberSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  userId: z.string().min(1, 'Select a user from the dropdown'),
  role: z.enum(['owner', 'admin', 'member']),
})

type MemberFormValues = z.infer<typeof memberSchema>

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export default function OrganizationMembersPage() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const organizationId = params?.id
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [fetched, setFetched] = useState(false)
  const [refreshingMembers, setRefreshingMembers] = useState(false)
  const [selectedInvitee, setSelectedInvitee] = useState<User | null>(null)
  const memberUserIds = useMemo(
    () => members.map((member) => member.userId),
    [members]
  )

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { email: '', userId: '', role: 'member' },
  })

  const loadOrganization = useCallback(async (signal: AbortSignal) => {
    if (!organizationId) {
      return
    }
    try {
      const response = await organizationApi.get(organizationId, { signal })
      setOrganization(response.data ?? null)
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return
      }
      handleApiError({ error })
    }
  }, [organizationId])

  const loadMembers = useCallback(async (signal: AbortSignal) => {
    if (!organizationId) {
      return
    }
    try {
      setRefreshingMembers(true)
      const response = await organizationApi.listMembers(organizationId, {
        signal,
      })
      setMembers(response.data?.items ?? [])
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return
      }
      handleApiError({ error })
    } finally {
      setRefreshingMembers(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) {
      return
    }
    let cancelled = false
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setFetched(false)
      await Promise.all([
        loadOrganization(controller.signal),
        loadMembers(controller.signal),
      ])
      if (cancelled) {
        return
      }
      setLoading(false)
      setFetched(true)
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [organizationId, loadMembers, loadOrganization])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!organizationId) {
      toast.error('Missing organization identifier')
      return
    }

    try {
      const response = await organizationApi.addMember(organizationId, {
        userId: values.userId,
        role: values.role,
      })
      toast.success('Member added')
      form.reset({ email: '', userId: '', role: values.role })
      setSelectedInvitee(null)
      setMembers((prev) => {
        const payload = response.data
        if (!payload) {
          return prev
        }
        const enriched = selectedInvitee
          ? { ...payload, user: payload.user ?? selectedInvitee }
          : payload
        const existing = prev.find((member) => member.id === enriched.id)
        if (existing) {
          return prev.map((member) =>
            member.id === enriched.id ? enriched : member,
          )
        }
        return [enriched, ...prev]
      })
    } catch (error) {
      handleApiError({ error, setError: form.setError })
    }
  })

  const onRemoveMember = async (member: OrganizationMember) => {
    if (!organizationId) {
      toast.error('Missing organization identifier')
      return
    }
    if (member.role === 'owner') {
      toast.error('You cannot remove the owner of the organization.')
      return
    }
    if (member.userId === currentUserId) {
      toast.error('You cannot remove yourself.')
      return
    }
    const confirmed = window.confirm(
      `Remove ${
        member.user?.email ?? member.userId
      } from this organization?`
    )
    if (!confirmed) {
      return
    }
    try {
      await organizationApi.removeMember(organizationId, member.userId)
      toast.success('Member removed')
      setMembers((prev) => prev.filter((item) => item.userId !== member.userId))
    } catch (error) {
      handleApiError({ error })
    }
  }

  if (!organizationId) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <p className="text-sm text-rose-500">Invalid organization identifier.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Manage members
            </h1>
            <p className="text-sm text-slate-500">
              Invite collaborators and adjust their access levels.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/organizations/${organizationId}`)}>
          Back to organization
        </Button>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Organization
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {organization?.name ?? 'Loading organization…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-slate-600">
          {organization?.description ? (
            <p>{organization.description}</p>
          ) : (
            <p className="text-slate-400">No description provided.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur overflow-visible">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Invite member
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Add an existing user by their email and choose a role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <UserEmailSelect
                value={form.watch('email') ?? ''}
                onValueChange={(email) => {
                  setSelectedInvitee(null)
                  form.setValue('email', email, { shouldDirty: true })
                  form.setValue('userId', '', {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
                onUserSelected={(user) => {
                  setSelectedInvitee(user)
                  form.setValue('email', user.email, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                  form.setValue('userId', user.id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
                selectedUser={selectedInvitee}
                error={
                  form.formState.errors.email?.message ??
                  form.formState.errors.userId?.message
                }
                showError={form.formState.submitCount > 0}
                disabled={form.formState.isSubmitting}
                excludeUserIds={memberUserIds}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Role
              </label>
              <Select {...form.register('role')}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </Select>
              {form.formState.errors.role && (
                <p className="text-xs text-rose-500">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>
            <Button type="submit" className="gap-2" disabled={form.formState.isSubmitting}>
              <UserPlus className="size-4" />
              {form.formState.isSubmitting ? 'Inviting…' : 'Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Current members
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Remove collaborators who should no longer have access.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const controller = new AbortController()
              loadMembers(controller.signal)
            }}
            disabled={refreshingMembers}
          >
            {refreshingMembers ? 'Refreshing…' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading || !fetched ? (
            <p className="text-sm text-slate-500">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-500">
              No members yet. Invite teammates above.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {member.user
                      ? `${member.user.firstName ?? ''} ${
                          member.user.lastName ?? ''
                        }`.trim() || member.user.email
                      : member.userId}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.user?.email ?? member.userId}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {(member.role === 'owner' || member.userId === currentUserId) && (
                    <span className="text-xs text-slate-400">
                      {member.role === 'owner'
                        ? 'Owner cannot be removed'
                        : 'You cannot remove yourself'}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-600"
                    onClick={() => onRemoveMember(member)}
                    disabled={
                      member.role === 'owner' || member.userId === currentUserId
                    }
                  >
                    <Trash2 className="mr-1 size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
