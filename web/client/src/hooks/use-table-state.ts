'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { SortingState } from '@tanstack/react-table'
import { useDebounce } from './use-debounce'

interface UseTableStateOptions {
  storageKey: string
  enablePersistence?: boolean
  searchDebounceMs?: number
}

interface TableState {
  sorting: SortingState
  search: string
}

export function useTableState({ 
  storageKey, 
  enablePersistence = true,
  searchDebounceMs = 500 
}: UseTableStateOptions) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isInitialMount = useRef(true)

  // Initialize state from URL or localStorage
  const getInitialState = (): TableState => {
    // First, try to get from URL params
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')
    const search = searchParams.get('search') || ''

    if (sortBy) {
      return {
        sorting: [{ id: sortBy, desc: sortOrder === 'desc' }],
        search,
      }
    }

    // If not in URL and persistence is enabled, try localStorage
    if (enablePersistence && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as TableState
          return parsed
        } catch {
          // Ignore parse errors
        }
      }
    }

    return { sorting: [], search: '' }
  }

  const [sorting, setSorting] = useState<SortingState>(getInitialState().sorting)
  const [search, setSearch] = useState<string>(getInitialState().search)
  
  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, searchDebounceMs)

  // Sync with URL and localStorage when sorting or debounced search changes
  useEffect(() => {
    // Skip the first render to avoid syncing with the initial state
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const params = new URLSearchParams()
    
    // Update URL params
    if (sorting.length > 0) {
      const sort = sorting[0]
      params.set('sortBy', sort.id)
      params.set('sortOrder', sort.desc ? 'desc' : 'asc')
    }

    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    }

    // Update URL without triggering navigation
    const newSearch = params.toString()
    const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname
    router.replace(newUrl, { scroll: false })

    // Persist to localStorage
    if (enablePersistence && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({ sorting, search: debouncedSearch }))
    }
  }, [sorting, debouncedSearch, pathname, router, storageKey, enablePersistence])

  const handleSetSorting = useCallback((newSorting: SortingState) => {
    setSorting(newSorting)
  }, [])

  const handleSetSearch = useCallback((newSearch: string) => {
    setSearch(newSearch)
  }, [])

  const clearAll = useCallback(() => {
    setSorting([])
    setSearch('')
    if (enablePersistence && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }, [storageKey, enablePersistence])

  return {
    sorting,
    search,
    debouncedSearch,
    setSorting: handleSetSorting,
    setSearch: handleSetSearch,
    clearAll,
  }
}
