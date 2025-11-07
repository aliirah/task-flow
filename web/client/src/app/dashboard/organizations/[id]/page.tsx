'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Layers, Users } from 'lucide-react'

import { organizationApi } from '@/lib/api'
import type { Organization, OrganizationMember } from '@/lib/types/api'
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

interface OrganizationDetailPageProps {
  params: { id: string }
}

export default function OrganizationDetailPage({
  params,
}: OrganizationDetailPageProps) {
  const router = useRouter()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [orgResponse, memberResponse] = await Promise.all([
          organizationApi.get(params.id),
          organizationApi.listMembers(params.id),
        ])
        setOrganization(orgResponse.data ?? null)
        setMembers(memberResponse.data?.items ?? [])
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
            <Layers className="size-4" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {organization?.name ?? 'Organization'}
            </h1>
            <p className="text-sm text-slate-500">
              Overview and membership details.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/organizations')}
          >
            Back
          </Button>
          <Button
            onClick={() =>
              router.push(`/dashboard/organizations/${params.id}/edit`)
            }
          >
            Edit organization
          </Button>
        </div>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Organization details
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Metadata and description for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-600">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !organization ? (
            <p className="text-sm text-rose-500">Organization not found.</p>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase text-slate-400">Description</p>
                <p className="mt-1 text-base text-slate-800">
                  {organization.description || 'No description provided.'}
                </p>
              </div>
              <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                <div>
                  <p className="text-xs uppercase text-slate-400">Owner</p>
                  <p className="mt-1 text-base text-slate-800">
                    {organization.ownerId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Created at
                  </p>
                  <p className="mt-1 text-base text-slate-800">
                    {organization.createdAt
                      ? new Date(organization.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                <div>
                  <p className="text-xs uppercase text-slate-400">Updated at</p>
                  <p className="mt-1 text-base text-slate-800">
                    {organization.updatedAt
                      ? new Date(organization.updatedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Members count
                  </p>
                  <p className="mt-1 text-base text-slate-800">
                    {members.length}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Members
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              People who can access this workspace.
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/organizations/${params.id}/edit`}>
              Manage members
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">
              No members yet. Invite teammates from the edit page.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
                    {member.user
                      ? `${member.user.firstName?.[0] ?? ''}${
                          member.user.lastName?.[0] ?? ''
                        }`.toUpperCase()
                      : 'M'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {member.user
                        ? `${member.user.firstName} ${member.user.lastName}`
                        : member.userId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {member.user?.email ?? 'No email on record'}
                    </p>
                  </div>
                </div>
                <Badge tone="default">
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
