import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { configureAuth } from '../api/client'
import type { CurrentUserResponse } from '../api/contracts'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const tokenRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<CurrentUserResponse | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('anonymous')

  const logout = useCallback((reason: 'manual' | 'expired' = 'manual') => {
    void reason
    tokenRef.current = null
    setToken(null)
    setUser(null)
    setExpiresAt(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    configureAuth(
      () => tokenRef.current,
      (failedToken) => { if (failedToken === tokenRef.current) logout('expired') },
    )
  }, [logout])

  useEffect(() => {
    if (!expiresAt) return
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const timer = window.setTimeout(() => logout('expired'), Math.min(delay, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [expiresAt, logout])

  const login = useCallback(async (username: string, password: string) => {
    setStatus('authenticating')
    try {
      const response = await authApi.login(username, password)
      tokenRef.current = response.accessToken
      setToken(response.accessToken)
      setExpiresAt(response.expiresAt)
      const current = await authApi.me()
      setUser(current)
      setStatus('authenticated')
      return current
    } catch (error) {
      logout()
      throw error
    }
  }, [logout])

  const value = useMemo<AuthState>(() => ({ token, user, expiresAt, status, login, logout }), [expiresAt, login, logout, status, token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
