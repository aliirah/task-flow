'use client'

import { apiClient } from './client'
import type { AuthResponse, RegisterData } from '@/lib/types/api'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: RegisterData) =>
    apiClient<void>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiClient<void>('/auth/logout', {
      method: 'POST',
    }),
}