import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL

interface ApiResponse<T> {
  requestId: string
  status: 'success' | 'error'
  data: T
  error?: {
    code: string
    message: string
  }
}

class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const authStore = useAuthStore.getState()
  const { accessToken } = authStore

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  })

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: headers as HeadersInit,
  })

  const data = await response.json()

  if (!response.ok) {
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken()
      if (refreshed) {
        // Retry the original request
        return api(endpoint, options)
      }
      // If refresh failed, clear auth and throw error
      authStore.clearAuth()
    }
    throw new ApiError(data.error?.code || 'UNKNOWN_ERROR', data.error?.message || 'An unknown error occurred')
  }

  return data
}

async function refreshToken(): Promise<boolean> {
  const authStore = useAuthStore.getState()
  const { refreshToken } = authStore

  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    authStore.setAuth(data.data)
    return true
  } catch {
    return false
  }
}

export const auth = {
  login: (email: string, password: string) =>
    api<{
      accessToken: string
      refreshToken: string
      expiresAt: string
      user: any
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
  }) =>
    api<void>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}