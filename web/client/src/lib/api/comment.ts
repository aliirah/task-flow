'use client'

import { apiClient } from './client'
import type { Comment, CommentListResponse } from '@/lib/types/api'

export const commentApi = {
  list: (
    taskId: string,
    params?: {
      page?: number
      limit?: number
      includeReplies?: boolean
    }
  ) => {
    const search = new URLSearchParams()
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.includeReplies !== undefined) search.set('includeReplies', String(params.includeReplies))

    const query = search.toString()
    return apiClient<CommentListResponse>(
      `/api/tasks/${taskId}/comments${query ? `?${query}` : ''}`
    )
  },

  create: (
    taskId: string,
    payload: {
      content: string
      parentCommentId?: string
      mentionedUsers?: string[]
    }
  ) =>
    apiClient<Comment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  get: (id: string) => apiClient<Comment>(`/api/comments/${id}`),

  update: (
    id: string,
    payload: {
      content: string
      mentionedUsers?: string[]
    }
  ) =>
    apiClient<Comment>(`/api/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) => apiClient<void>(`/api/comments/${id}`, { method: 'DELETE' }),
}
