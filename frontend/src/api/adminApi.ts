import { ApiError, apiDownload, apiRequest, apiUpload } from './client'
import type { AdminMlOverviewResponse, BranchInventoryResponse, BranchResponse, DateOverrideResponse, FeedbackStatisticsResponse, InventoryImportResultResponse, InventoryLotResponse, InventoryTransactionResponse, PartResponse, SlotAvailabilityResponse, SlotRule, StatisticsOverviewResponse, StockInResponse, SystemSettingResponse, TechnicianScheduleResponse, UserResponse, WeeklyScheduleResponse } from './contracts'
import { inventoryTransactionCode } from '../utils/inventory'

type InventoryHistoryFilters = { branchId?: number; partId?: number; transactionType?: string; from?: string; to?: string; code?: string }

async function inventoryTransactionHistory(filters: InventoryHistoryFilters = {}, signal?: AbortSignal) {
  try {
    return await apiRequest<InventoryTransactionResponse[]>('/api/v1/admin/inventory/transactions', { auth: true, query: filters, signal })
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 500, 503].includes(error.status)) throw error
    const partIds = filters.partId
      ? [filters.partId]
      : (await apiRequest<PartResponse[]>('/api/v1/admin/parts', { auth: true, signal })).map(part => part.id)
    const histories = await Promise.all(partIds.map(partId =>
      apiRequest<InventoryTransactionResponse[]>(`/api/v1/admin/parts/${partId}/inventory-transactions`, { auth: true, signal })))
    const code = filters.code?.trim().toLocaleLowerCase('vi')
    return histories.flat().filter(row => {
      const date = row.createdAt.slice(0, 10)
      const matchesBranch = !filters.branchId || row.sourceBranchId === filters.branchId || row.destinationBranchId === filters.branchId
      const matchesCode = !code
        || inventoryTransactionCode(row).toLocaleLowerCase('vi').includes(code)
        || String(row.id).includes(code.replace(/^(nhap|xuat|chuyen)_?/, ''))
        || row.lotCode?.toLocaleLowerCase('vi').includes(code)
      return matchesBranch
        && (!filters.transactionType || row.transactionType === filters.transactionType)
        && (!filters.from || date >= filters.from)
        && (!filters.to || date <= filters.to)
        && Boolean(matchesCode)
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id - left.id)
  }
}

export const adminApi = {
  statistics: (filters: { from: string; to: string; branchId?: number; deviceTypeId?: number }, signal?: AbortSignal) =>
    apiRequest<StatisticsOverviewResponse>('/api/v1/admin/statistics/overview', { auth: true, query: filters, signal }),
  feedbackStatistics: (filters: { from: string; to: string }, signal?: AbortSignal) =>
    apiRequest<FeedbackStatisticsResponse>('/api/v1/admin/statistics/feedback', { auth: true, query: filters, signal }),
  mlOverview: (signal?: AbortSignal) => apiRequest<AdminMlOverviewResponse>('/api/v1/admin/ml/overview', { auth: true, signal }),
  settings: (signal?: AbortSignal) => apiRequest<SystemSettingResponse[]>('/api/v1/admin/system-settings', { auth: true, signal }),
  updateSetting: (key: string, settingValue: string) => apiRequest<SystemSettingResponse>(`/api/v1/admin/system-settings/${encodeURIComponent(key)}`, { auth: true, method: 'PUT', body: { settingValue } }),
  resourceList: <T>(resource: string, signal?: AbortSignal) => apiRequest<T[]>(`/api/v1/admin/${resource}`, { auth: true, signal }),
  resourceCreate: <T>(resource: string, body: unknown) => apiRequest<T>(`/api/v1/admin/${resource}`, { auth: true, method: 'POST', body }),
  resourceUpdate: <T>(resource: string, id: number, body: unknown) => apiRequest<T>(`/api/v1/admin/${resource}/${id}`, { auth: true, method: 'PUT', body }),
  resourceDelete: (resource: string, id: number) => apiRequest<void>(`/api/v1/admin/${resource}/${id}`, { auth: true, method: 'DELETE' }),
  resourceStatus: <T>(resource: string, id: number, active: boolean) => apiRequest<T>(`/api/v1/admin/${resource}/${id}/${active ? 'activate' : 'deactivate'}`, { auth: true, method: 'POST' }),
  users: (signal?: AbortSignal) => apiRequest<UserResponse[]>('/api/v1/admin/users', { auth: true, signal }),
  createUser: (body: { username: string; password: string; fullName: string; phone?: string; role: string; status: string }) => apiRequest<UserResponse>('/api/v1/admin/users', { auth: true, method: 'POST', body }),
  updateUserProfile: (id: number, body: { fullName: string; phone?: string }) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/profile`, { auth: true, method: 'PUT', body }),
  updateUserRole: (id: number, role: string) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/role`, { auth: true, method: 'PUT', body: { role } }),
  updateUserStatus: (id: number, status: string) => apiRequest<UserResponse>(`/api/v1/admin/users/${id}/status`, { auth: true, method: 'PUT', body: { status } }),
  resetUserPassword: (id: number, password: string) => apiRequest<void>(`/api/v1/admin/users/${id}/password`, { auth: true, method: 'PUT', body: { password } }),
  branches: (signal?: AbortSignal) => apiRequest<BranchResponse[]>('/api/v1/admin/branches', { auth: true, signal }),
  parts: (signal?: AbortSignal) => apiRequest<PartResponse[]>('/api/v1/admin/parts', { auth: true, signal }),
  inventory: (branchId: number, partId: number, signal?: AbortSignal) => apiRequest<BranchInventoryResponse>('/api/v1/internal/inventory', { auth: true, query: { branchId, partId }, signal }),
  inventories: (filters: { branchId?: number; partId?: number } = {}, signal?: AbortSignal) => apiRequest<BranchInventoryResponse[]>('/api/v1/admin/inventory', { auth: true, query: filters, signal }),
  inventoryTransactions: (partId: number, signal?: AbortSignal) => apiRequest<InventoryTransactionResponse[]>(`/api/v1/admin/parts/${partId}/inventory-transactions`, { auth: true, signal }),
  inventoryTransactionHistory,
  inventoryLots: (filters: { branchId?: number; partId?: number } = {}, signal?: AbortSignal) => apiRequest<InventoryLotResponse[]>('/api/v1/admin/inventory/lots', { auth: true, query: filters, signal }),
  inventoryImportTemplate: () => apiDownload('/api/v1/admin/inventory/import-template'),
  importInventory: (file: File) => apiUpload<InventoryImportResultResponse>('/api/v1/admin/inventory/import', file),
  stockIn: (body: { lotCode: string; branchId: number; partId: number; quantity: number; receivedAt: string; sourceNote?: string }) => apiRequest<StockInResponse>('/api/v1/admin/inventory/stock-in', { auth: true, method: 'POST', body }),
  stockOut: (body: { branchId: number; partId: number; quantity: number; note?: string }) => apiRequest<BranchInventoryResponse>('/api/v1/admin/inventory/stock-out', { auth: true, method: 'POST', body }),
  transferStock: (body: { partId: number; sourceBranchId: number; destinationBranchId: number; quantity: number; note?: string }) => apiRequest('/api/v1/admin/inventory/transfer', { auth: true, method: 'POST', body }),
  slots: (branchId: number, date: string, signal?: AbortSignal) => apiRequest<SlotAvailabilityResponse[]>('/api/v1/admin/appointment-slots', { auth: true, query: { branchId, date }, signal }),
  weeklySchedules: (branchId: number, signal?: AbortSignal) => apiRequest<WeeklyScheduleResponse[]>('/api/v1/admin/appointment-weekly-schedules', { auth: true, query: { branchId }, signal }),
  saveWeekday: (body: WeeklyScheduleResponse) => apiRequest<WeeklyScheduleResponse>('/api/v1/admin/appointment-weekly-schedules', { auth: true, method: 'PUT', body }),
  saveWeekdays: (body: WeeklyScheduleResponse[]) => apiRequest<WeeklyScheduleResponse[]>('/api/v1/admin/appointment-weekly-schedules/batch', { auth: true, method: 'PUT', body }),
  dateOverride: (branchId: number, date: string, signal?: AbortSignal) => apiRequest<DateOverrideResponse>('/api/v1/admin/appointment-date-overrides', { auth: true, query: { branchId, date }, signal }),
  saveDateOverride: (body: { branchId: number; date: string; mode: DateOverrideResponse['mode']; slots: SlotRule[] }) => apiRequest<DateOverrideResponse>('/api/v1/admin/appointment-date-overrides', { auth: true, method: 'PUT', body }),
  saveSlot: (id: number | undefined, body: { branchId: number; slotDate: string; startTime: string; endTime: string }) => apiRequest<SlotAvailabilityResponse>(id ? `/api/v1/admin/appointment-slots/${id}` : '/api/v1/admin/appointment-slots', { auth: true, method: id ? 'PUT' : 'POST', body }),
  setSlotOpen: (id: number, open: boolean) => apiRequest<SlotAvailabilityResponse>(`/api/v1/admin/appointment-slots/${id}/${open ? 'open' : 'close'}`, { auth: true, method: 'POST' }),
  deleteSlot: (id: number) => apiRequest<void>(`/api/v1/admin/appointment-slots/${id}`, { auth: true, method: 'DELETE' }),
  schedules: (technicianId: number, date: string, signal?: AbortSignal) => apiRequest<TechnicianScheduleResponse[]>('/api/v1/admin/technician-schedules', { auth: true, query: { technicianId, date }, signal }),
  saveSchedule: (id: number | undefined, body: { technicianId: number; branchId: number; workDate: string; startTime: string; endTime: string; status: string }) => apiRequest<TechnicianScheduleResponse>(id ? `/api/v1/admin/technician-schedules/${id}` : '/api/v1/admin/technician-schedules', { auth: true, method: id ? 'PUT' : 'POST', body }),
  deleteSchedule: (id: number) => apiRequest<void>(`/api/v1/admin/technician-schedules/${id}`, { auth: true, method: 'DELETE' }),
}
