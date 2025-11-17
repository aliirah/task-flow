'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckSquare,
  Loader2,
  MessageSquareMore,
  Search,
  UserRound,
} from 'lucide-react'

import { searchApi } from '@/lib/api/search'
import type { SearchResult, SearchResultType } from '@/lib/types/api'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

type GlobalSearchProps = {
  className?: string
  variant?: 'inline' | 'modal'
  autoFocus?: boolean
  onNavigate?: () => void
}

const TYPE_META: Record<
  SearchResultType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  task: { label: 'Task', icon: CheckSquare },
  comment: { label: 'Comment', icon: MessageSquareMore },
  user: { label: 'User', icon: UserRound },
}

const MIN_QUERY_LENGTH = 2

export function GlobalSearch({
  className,
  variant = 'inline',
  autoFocus = false,
  onNavigate,
}: GlobalSearchProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 400)
  const trimmedQuery = query.trim()
  const accessToken = useAuthStore((state) => state.accessToken)
  const isAuthenticated = Boolean(accessToken)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (variant === 'modal') {
      setOpen(true)
    }
  }, [variant])

  useEffect(() => {
    if (variant === 'modal') {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [variant])

  useEffect(() => {
    const normalized = debouncedQuery.trim()
    if (!isAuthenticated) {
      setSuggestions([])
      return
    }
    if (normalized.length < MIN_QUERY_LENGTH) {
      setResults([])
      setSuggestions([])
      setError(null)
      return
    }

    let cancelled = false
    setSuggestLoading(true)
    searchApi
      .suggest({ query: normalized, limit: 6 })
      .then((resp) => {
        if (cancelled) return
        setSuggestions(resp.data?.results ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSuggestLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isAuthenticated])

  useEffect(() => {
    const normalized = debouncedQuery.trim()
    if (!isAuthenticated) {
      setResults([])
      setError(null)
      return
    }
    if (normalized.length < MIN_QUERY_LENGTH) {
      setResults([])
      setError(null)
      return
    }

    let cancelled = false
    setResultsLoading(true)
    setError(null)
    searchApi
      .search({ query: normalized, limit: 8 })
      .then((resp) => {
        if (cancelled) return
        setResults(resp.data?.results ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setResults([])
          setError('Unable to fetch search results right now.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResultsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isAuthenticated])

  const placeholder = isAuthenticated
    ? 'Search tasks, comments, users...'
    : 'Sign in to search the workspace'
  const showPanel =
    isAuthenticated &&
    (variant === 'modal' || open) &&
    (trimmedQuery.length >= MIN_QUERY_LENGTH ||
      results.length > 0 ||
      resultsLoading ||
      error)

  const suggestionChips = useMemo(() => {
    if (trimmedQuery.length === 0) return []
    return suggestions.filter(
      (suggestion) =>
        suggestion.toLowerCase() !== trimmedQuery.toLowerCase()
    )
  }, [suggestions, trimmedQuery])

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'user') {
      if (result.email) {
        window.open(`mailto:${result.email}`, '_self')
      }
    } else if (result.type === 'task') {
      router.push(`/dashboard/tasks/${result.id}`)
    } else if (result.type === 'comment') {
      const taskId = result.taskId ?? result.metadata?.taskId
      if (taskId) {
        router.push(`/dashboard/tasks/${taskId}?commentId=${result.id}`)
      }
    }

    onNavigate?.()
    setQuery('')
    setResults([])
    setSuggestions([])
    if (variant !== 'modal') {
      setOpen(false)
    }
  }

  const handleSubmit = () => {
    if (results[0]) {
      handleResultClick(results[0])
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full',
        variant === 'inline' ? 'max-w-xl' : 'w-full',
        className
      )}
    >
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-slate-400" />
        <Input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          className="h-11 w-full rounded-full border-slate-200 bg-white pl-10 pr-10 text-sm shadow-xs focus-visible:ring-primary/30"
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
          disabled={!isAuthenticated}
        />
        {(resultsLoading || suggestLoading) && (
          <Loader2 className="absolute right-3 size-4 animate-spin text-slate-400" />
        )}
      </div>

      {!isAuthenticated ? (
        <div
          className={cn(
            'mt-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-500',
            variant === 'inline' ? 'absolute left-0 right-0 z-30' : 'relative'
          )}
        >
          Sign in to search across tasks, comments, and teammates.
        </div>
      ) : null}

      {showPanel && (
        <div
          className={cn(
            'mt-3 rounded-2xl border border-slate-100 bg-white shadow-xl ring-1 ring-slate-100/80',
            variant === 'inline'
              ? 'absolute left-0 right-0 z-30 max-h-[70vh] overflow-y-auto'
              : 'relative z-10 max-h-[60vh] overflow-y-auto'
          )}
        >
          {suggestionChips.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              {suggestionChips.map((suggestion) => (
                <button
                  key={suggestion}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white"
                  onClick={() => {
                    setQuery(suggestion)
                    if (variant !== 'modal') {
                      setOpen(true)
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 p-3">
            {resultsLoading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Searching the workspace…
              </div>
            ) : null}

            {!resultsLoading && trimmedQuery.length >= MIN_QUERY_LENGTH && results.length === 0 && !error ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                No matches yet. Try a different keyword or adjust your filters.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {results.map((result) => {
              const meta = TYPE_META[result.type]
              const Icon = meta.icon
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-slate-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-slate-100 p-2 text-slate-500">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-transparent bg-slate-100 text-[11px] font-medium uppercase text-slate-600"
                        >
                          {meta.label}
                        </Badge>
                        {result.score ? (
                          <span className="text-xs text-slate-400">
                            {(result.score * 100).toFixed(0)}% match
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {result.title}
                      </p>
                      {result.summary ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {result.summary}
                        </p>
                      ) : null}
                      {result.type === 'user' && result.email ? (
                        <p className="mt-1 text-sm text-slate-500">{result.email}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
