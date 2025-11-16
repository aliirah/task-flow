'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/api/auth/refresh']

const isPublicPath = (pathname: string) => {
  if (!pathname) return true
  return (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico'
  )
}

const hasAccessToken = () => {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie.startsWith('accessToken='))
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    const publicRoute = isPublicPath(pathname)
    const isApiRoute = pathname.startsWith('/api/')
    const tokenPresent = hasAccessToken()

    if (!publicRoute && !tokenPresent) {
      const params = new URLSearchParams()
      if (pathname && pathname !== '/') {
        params.set('from', pathname)
      }
      router.replace(`/auth/login${params.toString() ? `?${params.toString()}` : ''}`)
    }

    if (!isApiRoute && publicRoute && tokenPresent && pathname.startsWith('/auth')) {
      router.replace('/dashboard')
    }
  }, [pathname, router])

  return <>{children}</>
}
