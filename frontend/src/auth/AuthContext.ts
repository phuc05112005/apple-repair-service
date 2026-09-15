import { createContext } from 'react'
import type { CurrentUserResponse } from '../api/contracts'

export interface AuthState {
  token: string | null
  user: CurrentUserResponse | null
  expiresAt: string | null
  status: 'anonymous' | 'authenticating' | 'authenticated'
  login: (username: string, password: string) => Promise<CurrentUserResponse>
  logout: (reason?: 'manual' | 'expired') => void
}

export const AuthContext = createContext<AuthState | null>(null)
