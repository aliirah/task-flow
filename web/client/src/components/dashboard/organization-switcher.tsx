'use client'

import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

import type { Organization, OrganizationMember } from '@/lib/types/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OrganizationSwitcherProps {
  open: boolean
  loading: boolean
  selectedOrganization?: Organization
  selectedOrganizationId: string | null
  organizations: Organization[]
  memberships: OrganizationMember[]
  query: string
  onQueryChange: (value: string) => void
  onToggle: () => void
  onClose: () => void
  onSelect: (orgId: string | null) => void
  onManage: () => void
  onCreate: () => void
}

export const OrganizationSwitcher = forwardRef<
  HTMLDivElement,
  OrganizationSwitcherProps
>(
  (
    {
      open,
      loading,
      selectedOrganization,
      selectedOrganizationId,
      organizations,
      memberships,
      query,
      onQueryChange,
      onToggle,
      onClose,
      onSelect,
      onManage,
      onCreate,
    },
    ref
  ) => (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        className="flex cursor-pointer items-center gap-3 rounded-full border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
        onClick={onToggle}
        disabled={loading}
      >
        <div className="flex flex-col items-start text-left">
          <span className="text-xs text-slate-400">Workspace</span>
          <span className="text-sm font-semibold text-slate-900">
            {selectedOrganization?.name ?? 'All organizations'}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-slate-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-3 w-[380px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs uppercase text-slate-400">Workspace</p>
            <p className="text-sm font-semibold text-slate-900">
              Choose an organization to focus on
            </p>
          </div>
          <div className="px-4 py-3">
            <Input
              placeholder="Search organizations…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 text-sm"
            />
          </div>
          <div className="max-h-80 overflow-y-auto px-2 pb-3">
            {loading ? (
              <p className="px-3 py-2 text-sm text-slate-500">
                Loading organizations…
              </p>
            ) : organizations.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">
                {query ? 'No organizations match your search.' : 'No organizations yet.'}
              </p>
            ) : (
              organizations.map((org) => {
                const membership = memberships.find(
                  (member) =>
                    member.organizationId === org.id ||
                    member.organization?.id === org.id
                )
                const isActive = org.id === selectedOrganizationId
                return (
                  <button
                    type="button"
                    key={org.id}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-slate-100',
                      isActive && 'bg-slate-900/5 text-slate-900'
                    )}
                    onClick={() => {
                      onSelect(org.id)
                      onClose()
                    }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900/10 text-sm font-semibold text-slate-700">
                      {org.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <p className="font-semibold text-slate-900">{org.name}</p>
                      <p className="text-xs text-slate-500">
                        {org.description || 'No description yet'}
                      </p>
                    </div>
                    <Badge tone="default" className="ml-auto">
                      {membership?.role
                        ? membership.role.charAt(0).toUpperCase() +
                          membership.role.slice(1)
                        : 'Member'}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Total organizations: {organizations.length || '—'}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  onClose()
                  onManage()
                }}
              >
                Manage
              </Button>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  onClose()
                  onCreate()
                }}
              >
                New
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
)

OrganizationSwitcher.displayName = 'OrganizationSwitcher'

