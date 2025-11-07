import { create, StateCreator } from 'zustand'
import { persist, PersistOptions } from 'zustand/middleware'

export interface User {
  email: string
  firstName: string
  id: string
  lastName: string
  roles: string[]
  status: string
  userType: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
  setAuth: (auth: {
    user: User
    accessToken: string
    refreshToken: string
    expiresAt: string
  }) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

type AuthStorePersist = (
  config: StateCreator<AuthState>,
  options: PersistOptions<AuthState>
) => StateCreator<AuthState>

export const useAuthStore = create<AuthState>()(
  (persist as AuthStorePersist)(
    (set: (state: Partial<AuthState> | ((state: AuthState) => AuthState)) => void) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      setAuth: (auth: { user: User; accessToken: string; refreshToken: string; expiresAt: string }) => set(auth),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, expiresAt: null }),
      updateUser: (user: Partial<User>) =>
        set((state) =>
          ({
            ...state,
            user: state.user ? { ...state.user, ...user } : state.user,
          }) as AuthState
        ),
    }),
    {
      name: 'auth-storage',
    }
  )
)
