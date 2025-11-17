'use client'

import { apiClient } from './client'
import type { SearchResponse, SearchSuggestResponse } from '@/lib/types/api'

const buildQuery = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value)
    }
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const searchApi = {
  search: (params: { query: string; organizationId: string; userId?: string; types?: string[]; limit?: number }) => {
    const query = buildQuery({
      q: params.query,
      organizationId: params.organizationId,
      userId: params.userId,
      types: params.types?.length ? params.types.join(',') : undefined,
      limit: params.limit ? String(params.limit) : undefined,
    })
    return apiClient<SearchResponse>(`/api/search${query}`)
  },
  suggest: (params: { query: string; organizationId: string; userId?: string; limit?: number }) => {
    const query = buildQuery({
      q: params.query,
      organizationId: params.organizationId,
      userId: params.userId,
      limit: params.limit ? String(params.limit) : undefined,
    })
    return apiClient<SearchSuggestResponse>(`/api/search/suggest${query}`)
  },
}
