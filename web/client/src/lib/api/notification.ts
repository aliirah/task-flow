'use client'

import { apiClient } from './client'
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/lib/types/api'

export const notificationApi = {
  list: (params?: {
    page?: number
    limit?: number
    unreadOnly?: boolean
  }) => {
    const search = new URLSearchParams()
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))
    // Backend expects is_read parameter: is_read=false for unread only
    if (params?.unreadOnly !== undefined) {
      search.set('is_read', params.unreadOnly ? 'false' : '')
    }

    const query = search.toString()
    return apiClient<NotificationListResponse>(
      `/api/notifications${query ? `?${query}` : ''}`
    )
  },

  getUnreadCount: () =>
    apiClient<UnreadCountResponse>('/api/notifications/unread/count'),

  markAsRead: (id: string) =>
    apiClient<Notification>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    apiClient<void>('/api/notifications/mark-all-read', {
      method: 'POST',
    }),

  delete: (id: string) =>
    apiClient<void>(`/api/notifications/${id}`, {
      method: 'DELETE',
    }),
}
