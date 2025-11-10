'use client'

import { createContext, useContext } from 'react'

import type { Organization, OrganizationMember } from '@/lib/types/api'

export type DashboardContextValue = {
  organizations: Organization[]
  memberships: OrganizationMember[]
  selectedOrganizationId: string | null
  selectedOrganization?: Organization
  setSelectedOrganizationId: (orgId: string | null) => void
  refreshOrganizations: () => Promise<void>
  loadingOrganizations: boolean
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
)

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext)
  if (!value) {
    throw new Error('useDashboard must be used within DashboardShell')
  }
  return value
}

