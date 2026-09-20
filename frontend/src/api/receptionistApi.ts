import { ApiError, apiRequest } from './client'
import type { AppointmentDetailResponse, AppointmentStatus, ApprovalStatus, AssignmentResponse, AssignmentSource, OperationalTicketResponse, PaymentMethod, RepairItemResponse, ServiceTicketDetailResponse, ServiceTicketStatus, TechnicianRecommendationResponse, TicketPaymentSummaryResponse } from './contracts'

function requireCustomerContact(detail: AppointmentDetailResponse): AppointmentDetailResponse {
  if (!detail.appointment?.customerFullName?.trim() || !detail.appointment?.customerPhone?.trim()) {
    throw new ApiError(502, 'APPOINTMENT_CONTACT_MISSING', 'API lịch hẹn chưa trả tên hoặc số điện thoại khách hàng. Vui lòng khởi động lại backend với bản mới rồi tải lại trang.')
  }
  return detail
}

export const receptionistApi = {
  appointments: async (filters: { branchId?: number; date?: string; status?: AppointmentStatus }, signal?: AbortSignal) =>
    (await apiRequest<AppointmentDetailResponse[]>('/api/v1/internal/appointments', { auth: true, query: filters, signal })).map(requireCustomerContact),
  appointment: async (id: number, signal?: AbortSignal) =>
    requireCustomerContact(await apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}`, { auth: true, signal })),
  readyForIntake: async (signal?: AbortSignal) =>
    (await apiRequest<AppointmentDetailResponse[]>('/api/v1/internal/appointments/ready-for-intake', { auth: true, signal })).map(requireCustomerContact),
  confirm: (id: number) => apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}/confirm`, { auth: true, method: 'POST' }),
  reschedule: (id: number, appointmentSlotId: number) => apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}/reschedule`, { auth: true, method: 'POST', body: { appointmentSlotId } }),
  cancel: (id: number, reason: string) => apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}/cancel`, { auth: true, method: 'POST', body: { reason } }),
  arrive: (id: number) => apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}/arrive`, { auth: true, method: 'POST' }),
  expire: (id: number) => apiRequest<AppointmentDetailResponse>(`/api/v1/internal/appointments/${id}/expire`, { auth: true, method: 'POST' }),
  intake: (appointmentDeviceId: number, request: { serialNumber?: string; storage?: string; receivedCondition: string; serviceCatalogItemIds?: number[] }) =>
    apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/appointment-devices/${appointmentDeviceId}/intake`, { auth: true, method: 'POST', body: request }),
  walkIn: (request: { customerFullName: string; phone: string; branchId: number; deviceModelId: number; serialNumber?: string; storage?: string; receivedCondition: string; serviceCatalogItemIds?: number[] }) =>
    apiRequest<ServiceTicketDetailResponse>('/api/v1/internal/service-tickets/walk-in', { auth: true, method: 'POST', body: request }),
  tickets: (filters: { branchId?: number; status?: ServiceTicketStatus; query?: string }, signal?: AbortSignal) =>
    apiRequest<OperationalTicketResponse[]>('/api/v1/internal/service-tickets', { auth: true, query: filters, signal }),
  ticket: (id: number, signal?: AbortSignal) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}`, { auth: true, signal }),
  recommendations: (id: number, signal?: AbortSignal) => apiRequest<TechnicianRecommendationResponse[]>(`/api/v1/internal/service-tickets/${id}/technician-recommendations`, { auth: true, signal }),
  assign: (id: number, technicianId: number, source: AssignmentSource) => apiRequest<AssignmentResponse>(`/api/v1/internal/service-tickets/${id}/assignments`, { auth: true, method: 'POST', body: { technicianId, source } }),
  approval: (itemId: number, decision: ApprovalStatus, note?: string) => apiRequest<RepairItemResponse>(`/api/v1/internal/repair-items/${itemId}/approval`, { auth: true, method: 'POST', body: { decision, note } }),
  paymentSummary: (id: number, signal?: AbortSignal) => apiRequest<TicketPaymentSummaryResponse>(`/api/v1/internal/service-tickets/${id}/payment-summary`, { auth: true, signal }),
  payment: (id: number, paymentMethod: PaymentMethod) => apiRequest<TicketPaymentSummaryResponse>(`/api/v1/internal/service-tickets/${id}/payment`, { auth: true, method: 'POST', body: { paymentMethod } }),
  settleZero: (id: number) => apiRequest<TicketPaymentSummaryResponse>(`/api/v1/internal/service-tickets/${id}/payment/settle-zero`, { auth: true, method: 'POST' }),
  handover: (id: number) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/handover`, { auth: true, method: 'POST' }),
  cancelTicket: (id: number, reason: string) => apiRequest<ServiceTicketDetailResponse>(`/api/v1/internal/service-tickets/${id}/cancel`, { auth: true, method: 'POST', body: { reason } }),
}
