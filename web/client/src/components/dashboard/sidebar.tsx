'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type NavItem = {
  icon: LucideIcon
  label: string
  href: string
}

interface DashboardSidebarProps {
  collapsed: boolean
  pathname: string
  items: NavItem[]
  onNavigate?: () => void
  mobile?: boolean
}

export function DashboardSidebar({
  collapsed,
  pathname,
  items,
  onNavigate,
  mobile = false,
}: DashboardSidebarProps) {
  const baseClasses = mobile
    ? 'flex h-full flex-col border-r border-slate-200 bg-white'
    : 'hidden min-h-screen border-r border-slate-200 bg-white/80 backdrop-blur-md transition-all duration-300 md:flex md:flex-col'
  const widthClass =
    collapsed && !mobile ? 'w-[84px]' : mobile ? 'w-72' : 'w-64'
  const showLabels = !collapsed || mobile

  return (
    <aside className={cn(baseClasses, widthClass)}>
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-lg">
          TF
        </div>
        {showLabels && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">Task Flow</span>
            <span className="text-xs text-slate-500">Organize your work</span>
          </div>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {items.map(({ icon: Icon, label, href }) => {
          const isRoot = href === '/dashboard'
          const isActive = isRoot
            ? pathname === '/dashboard'
            : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className="group"
            >
              <span
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  !showLabels && 'justify-center px-2',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="size-4" />
                {showLabels && <span>{label}</span>}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close navigation menu"
      />
      <div className="relative ml-0 h-full w-72 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  )
}

