import { apiRequest } from './client'
import type { CurrentUserResponse, LoginResponse } from './contracts'

export const authApi = {
  login: (username: string, password: string) => apiRequest<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: { username, password } }),
  me: () => apiRequest<CurrentUserResponse>('/api/v1/auth/me', { auth: true }),
}
