import { apiRequest } from './client'
import type {
  CreateAppointmentRequest, PublicAppointmentResponse, PublicBranchResponse, PublicCatalogResponse,
  PublicDeviceModelResponse, PublicFeedbackRequest, PublicFeedbackResponse, PublicNamedResponse,
  PublicTicketResponse, SlotAvailabilityResponse, WarrantyEligibilityResponse,
} from './contracts'

export const publicApi = {
  deviceTypes: (signal?: AbortSignal) => apiRequest<PublicNamedResponse[]>('/api/v1/device-types', { signal }),
  deviceModels: (deviceTypeId?: number, signal?: AbortSignal) => apiRequest<PublicDeviceModelResponse[]>('/api/v1/device-models', { query: { deviceTypeId }, signal }),
  serviceIssues: (signal?: AbortSignal) => apiRequest<PublicNamedResponse[]>('/api/v1/service-issues', { signal }),
  catalog: (filters: { deviceModelId?: number; serviceIssueId?: number; serviceTypeId?: number }, signal?: AbortSignal) =>
    apiRequest<PublicCatalogResponse[]>('/api/v1/service-catalog-items', { query: filters, signal }),
  branches: (signal?: AbortSignal) => apiRequest<PublicBranchResponse[]>('/api/v1/branches', { signal }),
  slots: (branchId: number, date: string, signal?: AbortSignal) => apiRequest<SlotAvailabilityResponse[]>('/api/v1/appointment-slots', { query: { branchId, date }, signal }),
  createAppointment: (request: CreateAppointmentRequest) => apiRequest<PublicAppointmentResponse>('/api/v1/appointments', { method: 'POST', body: request }),
  appointmentsByPhone: (phone: string, signal?: AbortSignal) => apiRequest<PublicAppointmentResponse[]>('/api/v1/appointments/lookup', { query: { phone }, signal }),
  ticketsByPhone: (phone: string, signal?: AbortSignal) => apiRequest<PublicTicketResponse[]>('/api/v1/service-tickets/lookup', { query: { phone }, signal }),
  tickets: (lookup: { phone?: string; ticketCode?: string }, signal?: AbortSignal) => apiRequest<PublicTicketResponse[]>('/api/v1/service-tickets/lookup', { query: lookup, signal }),
  warrantyEligibility: (phone: string, repairItemId: number, signal?: AbortSignal) => apiRequest<WarrantyEligibilityResponse>('/api/v1/warranties/eligibility', { query: { phone, repairItemId }, signal }),
  feedback: (ticketCode: string, request: PublicFeedbackRequest) => apiRequest<PublicFeedbackResponse>(`/api/v1/service-tickets/${encodeURIComponent(ticketCode)}/feedback`, { method: 'POST', body: request }),
}
