'use client'

import { useAuthStore } from '@/store/auth'
import { ApiError, ApiResponse, AuthResponse } from '@/lib/types/api'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL
let refreshPromise: Promise<boolean> | null = null

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const authStore = useAuthStore.getState()
  const { accessToken } = authStore

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`
  } else if (endpoint.includes('notification')) {
    console.error('[apiClient] NO ACCESS TOKEN for notification request!')
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: defaultHeaders,
      credentials: 'include',
      mode: 'cors'
    })

    let data
    try {
      data = await response.json()
    } catch (e) {
      console.error('Response parsing error:', e)
      
      // Handle preflight errors
      if (response.status === 0) {
        throw new ApiError(
          'CORS_ERROR',
          'Unable to connect to the server due to CORS restrictions.'
        )
      }
      
      // Handle specific HTTP status codes
      switch (response.status) {
        case 404:
          throw new ApiError(
            'NOT_FOUND',
            'The requested resource was not found.'
          )
        case 403:
          throw new ApiError(
            'FORBIDDEN',
            'You do not have permission to access this resource.'
          )
        case 500:
          throw new ApiError(
            'SERVER_ERROR',
            'An internal server error occurred. Please try again later.'
          )
        default:
          if (!response.ok) {
            throw new ApiError(
              'NETWORK_ERROR',
              'Unable to connect to server. Please check your connection or try again later.'
            )
          }
          throw new ApiError(
            'PARSE_ERROR',
            'Unable to process the server response.'
          )
      }
    }

    if (!response.ok) {
      throw ApiError.fromResponse(data)
    }

    if (endpoint === '/api/auth/login' && data.status === 'success') {
      // Set the access token as a cookie for the middleware
      Cookies.set('accessToken', (data.data as AuthResponse).accessToken, {
        expires: new Date((data.data as AuthResponse).expiresAt),
        sameSite: 'lax'
      })
    }

    return data
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      throw error
    }
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      'NETWORK_ERROR',
      'Network error occurred. Please check your connection.'
    )
  }
}

export async function refreshToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const authStore = useAuthStore.getState()
    const storedRefreshToken = authStore.refreshToken

    if (!storedRefreshToken) {
      refreshPromise = null
      return false
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
        credentials: 'include',
      })

      if (!response.ok) {
        refreshPromise = null
        return false
      }

      const data = await response.json()
      if (data.status === 'success') {
        authStore.setAuth(data.data)
        Cookies.set('accessToken', data.data.accessToken, {
          expires: new Date(data.data.expiresAt),
          sameSite: 'lax',
        })
        refreshPromise = null
        return true
      }
      refreshPromise = null
      return false
    } catch {
      refreshPromise = null
      return false
    }
  })()

  return refreshPromise
}
