'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers, Plus } from 'lucide-react'

import { organizationApi } from '@/lib/api'
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
import { Badge } from '@/components/ui/badge'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export default function OrganizationsIndexPage() {
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const response = await organizationApi.listMine()
        setMemberships(response.data?.items ?? [])
      } catch (error) {
        handleApiError({ error })
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const organizations = useMemo(() => {
    const entries = memberships
      .map((membership) => membership.organization)
      .filter(Boolean) as Organization[]
    const unique = new Map<string, Organization>()
    entries.forEach((org) => unique.set(org.id, org))
    return Array.from(unique.values())
  }, [memberships])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Organizations
          </h1>
          <p className="text-sm text-slate-500">
            Everything you have access to across Task Flow.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/organizations/new">
            <Plus className="size-4" />
            New organization
          </Link>
        </Button>
      </header>

      <Card className="border border-white/60 bg-white/90 shadow-lg shadow-slate-200/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Your teams
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            You can edit or remove an organization by selecting it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading…</p>
          ) : organizations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              You’re not a member of any organizations yet. Create one to get
              started.
            </div>
          ) : (
            <div className="grid gap-4">
              {organizations.map((org) => {
                const membership = memberships.find(
                  (item) =>
                    item.organizationId === org.id ||
                    item.organization?.id === org.id
                )
                return (
                  <div
                    key={org.id}
                    className="flex flex-col items-start gap-4 rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-600">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {org.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {org.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {membership?.role && (
                        <Badge tone="default">
                          {ROLE_LABELS[membership.role] ?? membership.role}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-2"
                      >
                        <Link href={`/dashboard/organizations/${org.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
