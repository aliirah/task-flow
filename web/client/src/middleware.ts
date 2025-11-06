import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define an array of public paths that don't require authentication
const publicPaths = ['/auth/login', '/auth/register', '/api/auth/refresh']

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    
    // Check if the path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) ||
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/static/') ||
      pathname === '/favicon.ico'

    // Get the token from cookies
    const accessToken = request.cookies.get('accessToken')?.value

    // Create response to modify headers
    const response = NextResponse.next()

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_API_URL || '*')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return response
    }

    // Redirect unauthenticated users to login
    if (!isPublicPath && !accessToken) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Redirect authenticated users away from auth pages
    if (isPublicPath && accessToken && !pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}