'use client'

import { apiClient } from './client'
import type { User } from '@/lib/types/api'

export const userApi = {
  list: (params?: { q?: string; role?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.role) search.set('role', params.role)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))

    const query = search.toString()
    return apiClient<{ items: User[] }>(
      `/api/users${query ? `?${query}` : ''}`
    )
  },
  get: (id: string) => apiClient<User>(`/api/users/${id}`),
}
