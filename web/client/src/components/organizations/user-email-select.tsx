'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { userApi } from '@/lib/api'
import type { User } from '@/lib/types/api'
import { Input } from '@/components/ui/input'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserEmailSelectProps = {
  value: string
  onValueChange: (value: string) => void
  onUserSelected: (user: User) => void
  selectedUser?: User | null
  error?: string
  showError?: boolean
  disabled?: boolean
  placeholder?: string
  excludeUserIds?: string[]
}

export function UserEmailSelect({
  value,
  onValueChange,
  onUserSelected,
  selectedUser,
  error,
  showError = true,
  disabled,
  placeholder = 'name@example.com',
  excludeUserIds,
}: UserEmailSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestRef = useRef(0)
  const [results, setResults] = useState<User[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const excludeSet = useMemo(() => {
    if (!excludeUserIds || excludeUserIds.length === 0) {
      return new Set<string>()
    }
    return new Set(excludeUserIds.map((id) => id.toLowerCase()))
  }, [excludeUserIds])

  useEffect(() => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed || !emailPattern.test(trimmed)) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }

    const currentRequest = ++requestRef.current
    setSearching(true)

    const handle = setTimeout(async () => {
      try {
        const response = await userApi.list({ q: trimmed, limit: 5 })
        if (requestRef.current !== currentRequest) {
          return
        }
        const items = (response.data?.items ?? []).filter(
          (user) => !excludeSet.has(user.id.toLowerCase())
        )
        setResults(items)
        setOpen(true)
      } catch {
        if (requestRef.current === currentRequest) {
          setResults([])
          setOpen(true)
        }
      } finally {
        if (requestRef.current === currentRequest) {
          setSearching(false)
        }
      }
    }, 200)

    return () => {
      clearTimeout(handle)
    }
  }, [value, excludeSet])

  useEffect(() => {
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
  }, [])

  const handleSelect = (user: User) => {
    onUserSelected(user)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type="email"
        value={value}
        onFocus={() => {
          if (results.length > 0) {
            setOpen(true)
          }
        }}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {searching && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/90">
          {results.length === 0 && !searching ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              No users found with that email.
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {results.map((user) => {
                const fullName = [user.firstName, user.lastName]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => handleSelect(user)}
                    >
                      <span className="font-medium text-slate-900">
                        {user.email}
                      </span>
                      <span className="text-xs text-slate-500">
                        {fullName || 'No name provided'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {selectedUser && (
        <p className="mt-1 text-xs text-emerald-600">
          Inviting{' '}
          {[selectedUser.firstName, selectedUser.lastName]
            .filter(Boolean)
            .join(' ') || selectedUser.email}
        </p>
      )}
      {error && showError && (
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      )}
    </div>
  )
}
