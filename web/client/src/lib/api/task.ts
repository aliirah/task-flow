'use client'

import { apiClient } from './client'
import type { Task, TaskListResponse } from '@/lib/types/api'

export const taskApi = {
  list: (params?: {
    organizationId?: string
    status?: string
    assigneeId?: string
    reporterId?: string
    page?: number
    limit?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.organizationId) search.set('organizationId', params.organizationId)
    if (params?.status) search.set('status', params.status)
    if (params?.assigneeId) search.set('assigneeId', params.assigneeId)
    if (params?.reporterId) search.set('reporterId', params.reporterId)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))

    const query = search.toString()
    return apiClient<TaskListResponse>(
      `/api/tasks${query ? `?${query}` : ''}`
    )
  },
  create: (payload: {
    title: string
    description?: string
    status?: string
    priority?: string
    organizationId: string
    assigneeId?: string
    reporterId?: string
    dueAt?: string | null
  }) =>
    apiClient<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  get: (id: string) => apiClient<Task>(`/api/tasks/${id}`),
  update: (
    id: string,
    payload: Partial<{
      title: string
      description?: string
      status?: string
      priority?: string
      organizationId?: string
      assigneeId?: string | null
      reporterId?: string
      dueAt?: string | null
    }>
  ) =>
    apiClient<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => apiClient<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
}
