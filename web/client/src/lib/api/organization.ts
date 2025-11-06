'use client'

import { apiClient } from './client'
import type { Organization, OrganizationMember } from '@/lib/types/api'

export const organizationApi = {
  list: () => apiClient<{ items: Organization[] }>('/api/organizations'),
  listMine: () => apiClient<{ items: OrganizationMember[] }>('/api/organizations/mine'),
  get: (id: string) => apiClient<Organization>(`/api/organizations/${id}`),
  create: (payload: { name: string; description?: string }) =>
    apiClient<Organization>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<{ name: string; description?: string }>) =>
    apiClient<Organization>(`/api/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiClient<void>(`/api/organizations/${id}`, { method: 'DELETE' }),
  listMembers: (id: string) =>
    apiClient<{ items: OrganizationMember[] }>(`/api/organizations/${id}/members`),
  addMember: (id: string, payload: { userId: string; role?: string }) =>
    apiClient<OrganizationMember>(`/api/organizations/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeMember: (orgId: string, userId: string) =>
    apiClient<void>(`/api/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    }),
}
