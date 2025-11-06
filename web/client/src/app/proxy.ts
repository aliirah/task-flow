import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authData = request.cookies.get('auth-storage')
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
  const isRootPath = request.nextUrl.pathname === '/'

  // Parse the auth data to check if it's valid
  let isValidAuth = false
  if (authData?.value) {
    try {
      const parsed = JSON.parse(authData.value)
      isValidAuth = !!(parsed.state?.accessToken && parsed.state?.user)
    } catch (e) {
      isValidAuth = false
    }
  }

  // Handle root path
  if (isRootPath) {
    return isValidAuth
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Handle unauthenticated users
  if (!isValidAuth && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Handle authenticated users trying to access auth pages
  if (isValidAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}