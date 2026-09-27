import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { configureAuth } from '../api/client'
import type { CurrentUserResponse } from '../api/contracts'
import { AuthContext, type AuthState } from './AuthContext'
import { clearAuthSession, isSessionExpired, readAuthSession, writeAuthSession } from './session'

const expiredMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'

export function AuthProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const [bootstrap] = useState(() => {
    const session = readAuthSession()
    return { session, valid: Boolean(session && !isSessionExpired(session.expiresAt)) }
  })
  const tokenRef = useRef<string | null>(bootstrap.valid ? bootstrap.session!.token : null)
  const [token, setToken] = useState<string | null>(bootstrap.valid ? bootstrap.session!.token : null)
  const [user, setUser] = useState<CurrentUserResponse | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(bootstrap.valid ? bootstrap.session!.expiresAt : null)
  const [status, setStatus] = useState<AuthState['status']>(bootstrap.valid ? 'bootstrapping' : 'anonymous')
  const [notice, setNotice] = useState<string | null>(bootstrap.session && !bootstrap.valid ? expiredMessage : null)

  const logout = useCallback((reason: 'manual' | 'expired' = 'manual') => {
    tokenRef.current = null
    clearAuthSession()
    setToken(null)
    setUser(null)
    setExpiresAt(null)
    setStatus('anonymous')
    setNotice(reason === 'expired' ? expiredMessage : null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    configureAuth(() => tokenRef.current, failedToken => {
      if (failedToken === tokenRef.current) logout('expired')
    })
  }, [logout])

  useEffect(() => {
    if (!bootstrap.valid || !bootstrap.session) {
      clearAuthSession()
      return
    }
    authApi.me().then(current => {
      setUser(current)
      setStatus('authenticated')
    }).catch(() => logout('expired'))
  }, [bootstrap, logout])

  useEffect(() => {
    if (!expiresAt || status !== 'authenticated') return
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now())
    const timer = window.setTimeout(() => logout('expired'), Math.min(delay, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [expiresAt, logout, status])

  const login = useCallback(async (username: string, password: string) => {
    setStatus('authenticating')
    setNotice(null)
    try {
      const response = await authApi.login(username, password)
      tokenRef.current = response.accessToken
      setToken(response.accessToken)
      setExpiresAt(response.expiresAt)
      writeAuthSession({ token: response.accessToken, expiresAt: response.expiresAt })
      const current = await authApi.me()
      setUser(current)
      setStatus('authenticated')
      return current
    } catch (error) {
      tokenRef.current = null
      clearAuthSession()
      setToken(null)
      setUser(null)
      setExpiresAt(null)
      setStatus('anonymous')
      throw error
    }
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])
  const value = useMemo<AuthState>(() => ({ token, user, expiresAt, status, notice, clearNotice, login, logout }), [clearNotice, expiresAt, login, logout, notice, status, token, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
