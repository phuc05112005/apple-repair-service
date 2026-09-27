import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from './useAuth'
import { LoadingState } from '../components/AsyncState'

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'bootstrapping' || status === 'authenticating') return <div className="route-loading"><LoadingState label="Đang khôi phục phiên đăng nhập…" /></div>
  if (status !== 'authenticated' || !user) return <Navigate to="/internal/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (!roles.includes(user.role)) return <Navigate to={`/internal/${user.role.toLowerCase()}`} replace />
  return children
}

export function RoleHome() {
  const { status, user } = useAuth()
  if (status === 'bootstrapping' || status === 'authenticating') return <div className="route-loading"><LoadingState label="Đang khôi phục phiên đăng nhập…" /></div>
  if (status !== 'authenticated' || !user) return <Navigate to="/internal/login" replace />
  return <Navigate to={`/internal/${user.role.toLowerCase()}`} replace />
}
