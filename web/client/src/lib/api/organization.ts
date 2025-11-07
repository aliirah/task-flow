'use client'

import { apiClient } from './client'
import type { Organization, OrganizationMember } from '@/lib/types/api'

type RequestOptions = RequestInit | undefined

export const organizationApi = {
  list: (options?: RequestOptions) => apiClient<{ items: Organization[] }>('/api/organizations', options),
  listMine: (options?: RequestOptions) => apiClient<{ items: OrganizationMember[] }>('/api/organizations/mine', options),
  get: (id: string, options?: RequestOptions) => apiClient<Organization>(`/api/organizations/${id}`, options),
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
  listMembers: (id: string, options?: RequestOptions) =>
    apiClient<{ items: OrganizationMember[] }>(`/api/organizations/${id}/members`, options),
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
