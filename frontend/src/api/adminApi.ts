import { apiRequest } from './client'
import type { BranchInventoryResponse, BranchResponse, PartResponse, SlotAvailabilityResponse, StatisticsOverviewResponse, SystemSettingResponse, TechnicianScheduleResponse, UserResponse } from './contracts'

export const adminApi = {
  statistics: (filters: { from: string; to: string; branchId?: number; deviceTypeId?: number }, signal?: AbortSignal) =>
    apiRequest<StatisticsOverviewResponse>('/api/v1/admin/statistics/overview', { auth: true, query: filters, signal }),
  settings: (signal?: AbortSignal) => apiRequest<SystemSettingResponse[]>('/api/v1/admin/system-settings', { auth: true, signal }),
  updateSetting: (key: string, settingValue: string) => apiRequest<SystemSettingResponse>(`/api/v1/admin/system-settings/${encodeURIComponent(key)}`, { auth: true, method: 'PUT', body: { settingValue } }),
  resourceList: <T>(resource: string, signal?: AbortSignal) => apiRequest<T[]>(`/api/v1/admin/${resource}`, { auth: true, signal }),
  resourceCreate: <T>(resource: string, body: unknown) => apiRequest<T>(`/api/v1/admin/${resource}`, { auth: true, method: 'POST', body }),
  resourceUpdate: <T>(resource: string, id: number, body: unknown) => apiRequest<T>(`/api/v1/admin/${resource}/${id}`, { auth: true, method: 'PUT', body }),
  resourceDelete: (resource: string, id: number) => apiRequest<void>(`/api/v1/admin/${resource}/${id}`, { auth: true, method: 'DELETE' }),
  resourceStatus: <T>(resource: string, id: number, active: boolean) => apiRequest<T>(`/api/v1/admin/${resource}/${id}/${active ? 'activate' : 'deactivate'}`, { auth: true, method: 'POST' }),
  users: (signal?: AbortSignal) => apiRequest<UserResponse[]>('/api/v1/admin/users', { auth: true, signal }),
  createUser: (body: { username: string; password: string; fullName: string; phone?: string; role: string }) => apiRequest<UserResponse>('/api/v1/admin/users', { auth: true, method: 'POST', body }),
  updateUserProfile: (id: number, body: { fullName: string; phone?: string }) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/profile`, { auth: true, method: 'PUT', body }),
  updateUserRole: (id: number, role: string) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/role`, { auth: true, method: 'PUT', body: { role } }),
  updateUserStatus: (id: number, status: string) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/status`, { auth: true, method: 'PUT', body: { status } }),
  branches: (signal?: AbortSignal) => apiRequest<BranchResponse[]>('/api/v1/admin/branches', { auth: true, signal }),
  parts: (signal?: AbortSignal) => apiRequest<PartResponse[]>('/api/v1/admin/parts', { auth: true, signal }),
  inventory: (branchId: number, partId: number, signal?: AbortSignal) => apiRequest<BranchInventoryResponse>('/api/v1/internal/inventory', { auth: true, query: { branchId, partId }, signal }),
  adjustStock: (direction: 'stock-in' | 'stock-out', body: { branchId: number; partId: number; quantity: number; note?: string }) => apiRequest<BranchInventoryResponse>(`/api/v1/admin/inventory/${direction}`, { auth: true, method: 'POST', body }),
  transferStock: (body: { partId: number; sourceBranchId: number; destinationBranchId: number; quantity: number; note?: string }) => apiRequest('/api/v1/admin/inventory/transfer', { auth: true, method: 'POST', body }),
  slots: (branchId: number, date: string, signal?: AbortSignal) => apiRequest<SlotAvailabilityResponse[]>('/api/v1/admin/appointment-slots', { auth: true, query: { branchId, date }, signal }),
  saveSlot: (id: number | undefined, body: { branchId: number; slotDate: string; startTime: string; endTime: string }) => apiRequest<SlotAvailabilityResponse>(id ? `/api/v1/admin/appointment-slots/${id}` : '/api/v1/admin/appointment-slots', { auth: true, method: id ? 'PUT' : 'POST', body }),
  setSlotOpen: (id: number, open: boolean) => apiRequest<SlotAvailabilityResponse>(`/api/v1/admin/appointment-slots/${id}/${open ? 'open' : 'close'}`, { auth: true, method: 'POST' }),
  deleteSlot: (id: number) => apiRequest<void>(`/api/v1/admin/appointment-slots/${id}`, { auth: true, method: 'DELETE' }),
  schedules: (technicianId: number, date: string, signal?: AbortSignal) => apiRequest<TechnicianScheduleResponse[]>('/api/v1/admin/technician-schedules', { auth: true, query: { technicianId, date }, signal }),
  saveSchedule: (id: number | undefined, body: { technicianId: number; branchId: number; workDate: string; startTime: string; endTime: string; status: string }) => apiRequest<TechnicianScheduleResponse>(id ? `/api/v1/admin/technician-schedules/${id}` : '/api/v1/admin/technician-schedules', { auth: true, method: id ? 'PUT' : 'POST', body }),
  deleteSchedule: (id: number) => apiRequest<void>(`/api/v1/admin/technician-schedules/${id}`, { auth: true, method: 'DELETE' }),
}
