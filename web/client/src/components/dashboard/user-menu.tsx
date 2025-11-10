'use client'

import { forwardRef } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'

import type { User as AuthUser } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface UserMenuProps {
  open: boolean
  user: AuthUser | null
  initials: string
  membershipRole?: string
  onToggle: () => void
  onProfile: () => void
  onSignOut: () => void
}

export const UserMenu = forwardRef<HTMLDivElement, UserMenuProps>(
  (
    { open, user, initials, membershipRole, onToggle, onProfile, onSignOut },
    ref
  ) => {
    const roleLabel = membershipRole
      ? membershipRole.charAt(0).toUpperCase() + membershipRole.slice(1)
      : user?.email ?? 'team@taskflow.app'

    return (
      <div className="relative" ref={ref}>
        <Button
          variant="ghost"
          className="flex cursor-pointer items-center gap-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-sm shadow-sm"
          onClick={onToggle}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold text-slate-700">
            {initials}
          </div>
          <div className="hidden flex-col text-left md:flex">
            <span className="text-sm font-semibold text-slate-900">
              {user ? `${user.firstName} ${user.lastName}` : 'Task Flow'}
            </span>
            <span className="text-xs text-slate-500">{roleLabel}</span>
          </div>
          <ChevronDown
            className={cn(
              'size-4 text-slate-400 transition-transform',
              open && 'rotate-180'
            )}
          />
        </Button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
            <div className="border-b border-slate-100 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="flex flex-col px-1 py-1 text-sm">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                onClick={onProfile}
              >
                Profile
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-500 hover:bg-rose-50"
                onClick={onSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
)

UserMenu.displayName = 'UserMenu'

