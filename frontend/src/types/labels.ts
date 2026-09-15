import type { AppointmentStatus, PaymentStatus, ServiceTicketStatus } from '../api/contracts'

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', ARRIVED: 'Khách đã đến',
  CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn',
}
export const ticketStatusLabels: Record<ServiceTicketStatus, string> = {
  WAITING_ASSIGNMENT: 'Chờ phân công', ASSIGNED: 'Đã phân công', INSPECTING: 'Đang kiểm tra',
  WAITING_APPROVAL: 'Chờ khách xác nhận', REPAIRING: 'Đang sửa chữa', WAITING_PART: 'Chờ linh kiện',
  WAITING_HANDOVER: 'Chờ bàn giao', HANDED_OVER: 'Đã bàn giao', CANCELLED: 'Đã hủy',
}
export const paymentStatusLabels: Record<PaymentStatus, string> = { PENDING: 'Chưa thanh toán', PAID: 'Đã thanh toán' }
