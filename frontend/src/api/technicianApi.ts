import { apiRequest } from './client'
import type { AvailablePartResponse, IncomingTransferResponse, InspectionRepairItemRequest, OperationalTicketResponse, PartUsageResponse, RepairDurationResponse, RepairItemResponse, ServiceTicketDetailResponse, ServiceTicketStatus, TechnicianRecommendationResponse, TransferResponse, WarrantyDecision } from './contracts'

export const technicianApi = {
  work: (status?: ServiceTicketStatus, signal?: AbortSignal) => apiRequest<OperationalTicketResponse[]>('/api/v1/internal/technician/work', { auth: true, query: { status }, signal }),
  incomingTransfers: (signal?: AbortSignal) => apiRequest<IncomingTransferResponse[]>('/api/v1/internal/transfers/incoming', { auth: true, signal }),
  acceptTransfer: (id: number, note?: string) => apiRequest<TransferResponse>(`/api/v1/internal/transfers/${id}/accept`, { auth: true, method: 'POST', body: { note } }),
  rejectTransfer: (id: number, note?: string) => apiRequest<TransferResponse>(`/api/v1/internal/transfers/${id}/reject`, { auth: true, method: 'POST', body: { note } }),
  ticket: (id: number, signal?: AbortSignal) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}`, { auth: true, signal }),
  transferCandidates: (id: number, signal?: AbortSignal) => apiRequest<TechnicianRecommendationResponse[]>(`/api/v1/internal/service-tickets/${id}/transfer-candidates`, { auth: true, signal }),
  requestTransfer: (id: number, targetTechnicianId: number, note?: string) => apiRequest<TransferResponse>(`/api/v1/internal/service-tickets/${id}/transfers/request`, { auth: true, method: 'POST', body: { targetTechnicianId, note } }),
  availableParts: (id: number, query?: string, signal?: AbortSignal) => apiRequest<AvailablePartResponse[]>(`/api/v1/internal/service-tickets/${id}/available-parts`, { auth: true, query: { query }, signal }),
  partUsages: (itemId: number, signal?: AbortSignal) => apiRequest<PartUsageResponse[]>(`/api/v1/internal/repair-items/${itemId}/part-usages`, { auth: true, signal }),
  usePart: (itemId: number, partId: number, quantity: number) => apiRequest<PartUsageResponse>(`/api/v1/internal/repair-items/${itemId}/part-usages`, { auth: true, method: 'POST', body: { partId, quantity } }),
  reversePartUsage: (usageId: number, note?: string) => apiRequest<PartUsageResponse>(`/api/v1/internal/part-usages/${usageId}/reverse`, { auth: true, method: 'POST', body: { note } }),
  startInspection: (id: number) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/inspection/start`, { auth: true, method: 'POST' }),
  inspect: (id: number, request: { inspectionResult: string; requiresCustomerApproval: boolean; items: InspectionRepairItemRequest[] }) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/inspection`, { auth: true, method: 'POST', body: request }),
  waitForPart: (id: number, note?: string) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/wait-for-part`, { auth: true, method: 'POST', body: { note } }),
  resume: (id: number) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/resume-repair`, { auth: true, method: 'POST' }),
  finish: (id: number) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/finish-repair`, { auth: true, method: 'POST' }),
  duration: (id: number, signal?: AbortSignal) => apiRequest<RepairDurationResponse>(`/api/v1/internal/service-tickets/${id}/repair-duration`, { auth: true, signal }),
  warrantyDecision: (itemId: number, decision: Exclude<WarrantyDecision, null>, note?: string) => apiRequest<RepairItemResponse>(`/api/v1/internal/repair-items/${itemId}/warranty-decision`, { auth: true, method: 'POST', body: { decision, note } }),
}
