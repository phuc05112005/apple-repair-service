import { apiRequest } from './client'
import type { 
  CurrentUserResponse, 
  LoginResponse, 
  UserResponse, 
  UpdateUserProfileRequest, 
  ChangePasswordRequest 
} from './contracts'

export const authApi = {
  login: (username: string, password: string) => 
    apiRequest<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: { username, password } }),
  me: () => 
    apiRequest<CurrentUserResponse>('/api/v1/auth/me', { auth: true }),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/api/v1/auth/forgot-password', { method: 'POST', body: { email } }),
}

export const profileApi = {
  getProfile: () => 
    apiRequest<UserResponse>('/api/v1/profile', { auth: true }),
  updateProfile: (body: UpdateUserProfileRequest) => 
    apiRequest<UserResponse>('/api/v1/profile', { method: 'PUT', body, auth: true }),
  changePassword: (body: ChangePasswordRequest) => 
    apiRequest<void>('/api/v1/profile/change-password', { method: 'POST', body, auth: true }),
}