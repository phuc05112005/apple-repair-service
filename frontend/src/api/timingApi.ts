import { apiRequest } from './client'
import type { TicketTiming, TimeEstimateHistory, DefectivePartReturn, DefectivePartStatus } from './contracts'
export const timingApi = {
 history: (id: number, signal?: AbortSignal) => apiRequest<TimeEstimateHistory[]>(`/api/v1/internal/service-tickets/${id}/time-estimates`, { auth: true, signal }),
 manual: (id: number, request: { estimatedStartAt: string; estimatedCompletionAt: string; estimatedDurationMinutes: number; reason: string }) => apiRequest<TicketTiming>(`/api/v1/internal/service-tickets/${id}/eta`, { auth: true, method: 'PUT', body: request }),
 defectiveForTicket: (id: number, signal?: AbortSignal) => apiRequest<DefectivePartReturn[]>(`/api/v1/internal/service-tickets/${id}/defective-part-returns`, { auth: true, signal }),
 defective: (branchId?: number, partId?: number, signal?: AbortSignal) => apiRequest<DefectivePartReturn[]>('/api/v1/admin/defective-part-returns', { auth: true, query: { branchId, partId }, signal }),
 defectiveStatus: (id: number, status: DefectivePartStatus, note: string) => apiRequest<DefectivePartReturn>(`/api/v1/admin/defective-part-returns/${id}/status`, { auth: true, method: 'PUT', body: { status, note } }),
}
