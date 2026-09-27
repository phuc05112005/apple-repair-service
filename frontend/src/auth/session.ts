export const AUTH_SESSION_KEY = 'taocare.internal.auth'

export interface StoredAuthSession { token: string; expiresAt: string }

export function readAuthSession(storage: Pick<Storage, 'getItem'> = window.sessionStorage): StoredAuthSession | null {
  try {
    const raw = storage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredAuthSession>
    return typeof value.token === 'string' && typeof value.expiresAt === 'string' ? { token: value.token, expiresAt: value.expiresAt } : null
  } catch { return null }
}

export function writeAuthSession(value: StoredAuthSession, storage: Pick<Storage, 'setItem'> = window.sessionStorage) {
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(value))
}

export function clearAuthSession(storage: Pick<Storage, 'removeItem'> = window.sessionStorage) {
  storage.removeItem(AUTH_SESSION_KEY)
}

export function isSessionExpired(expiresAt: string, now = Date.now()) {
  const instant = Date.parse(expiresAt)
  return !Number.isFinite(instant) || instant <= now
}
