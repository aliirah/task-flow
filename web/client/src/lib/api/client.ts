'use client'

import { useAuthStore } from '@/store/auth'
import { ApiError, ApiResponse, AuthResponse } from '@/lib/types/api'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const authStore = useAuthStore.getState()
  const { accessToken } = authStore

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  })

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: headers as HeadersInit,
      credentials: 'include',
    })

    let data
    try {
      data = await response.json()
    } catch (e) {
      throw new ApiError(
        'NETWORK_ERROR',
        'Unable to connect to server. Please check your connection.'
      )
    }

    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await refreshToken()
        if (refreshed) {
          return apiClient(endpoint, options)
        }
        authStore.clearAuth()
        Cookies.remove('accessToken')
      }
      throw ApiError.fromResponse(data)
    }

    if (endpoint === '/auth/login' && data.status === 'success') {
      // Set the access token as a cookie for the middleware
      Cookies.set('accessToken', (data.data as AuthResponse).accessToken, {
        expires: new Date((data.data as AuthResponse).expiresAt),
        sameSite: 'lax'
      })
    }

    return data
  } catch (error) {
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
      credentials: 'include',
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    if (data.status === 'success') {
      authStore.setAuth(data.data)
      // Update the cookie when refreshing the token
      Cookies.set('accessToken', data.data.accessToken, {
        expires: new Date(data.data.expiresAt),
        sameSite: 'lax'
      })
      return true
    }
    return false
  } catch {
    return false
  }
}