'use client'

import { apiClient } from './client'
import type { AuthResponse, RegisterData } from '@/lib/types/api'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    }),

  register: (data: RegisterData) =>
    apiClient<void>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: (refreshToken: string) =>
    apiClient<void>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
}
