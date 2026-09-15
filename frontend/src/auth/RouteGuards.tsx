import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from './useAuth'

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated' || !user) return <Navigate to="/internal/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={`/internal/${user.role.toLowerCase()}`} replace />
  return children
}

export function RoleHome() {
  const { status, user } = useAuth()
  if (status !== 'authenticated' || !user) return <Navigate to="/internal/login" replace />
  return <Navigate to={`/internal/${user.role.toLowerCase()}`} replace />
}
