import type { AppointmentStatus, PaymentStatus, ServiceTicketStatus } from '../api/contracts'
import type { StatusTone } from '../components/StatusBadge'

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', ARRIVED: 'Khách đã đến',
  CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn',
}
export const appointmentStatusTones: Record<AppointmentStatus, StatusTone> = {
  PENDING_CONFIRMATION: 'warning', CONFIRMED: 'info', ARRIVED: 'success',
  CANCELLED: 'danger', EXPIRED: 'neutral',
}
export const ticketStatusLabels: Record<ServiceTicketStatus, string> = {
  WAITING_ASSIGNMENT: 'Chờ phân công', ASSIGNED: 'Đã phân công', INSPECTING: 'Đang kiểm tra',
  WAITING_APPROVAL: 'Chờ khách xác nhận', REPAIRING: 'Đang sửa chữa', WAITING_PART: 'Chờ linh kiện',
  WAITING_HANDOVER: 'Chờ bàn giao', HANDED_OVER: 'Đã bàn giao', CANCELLED: 'Đã hủy',
}
export const ticketStatusTones: Record<ServiceTicketStatus, StatusTone> = {
  WAITING_ASSIGNMENT: 'warning', ASSIGNED: 'info', INSPECTING: 'violet',
  WAITING_APPROVAL: 'rose', REPAIRING: 'teal', WAITING_PART: 'danger',
  WAITING_HANDOVER: 'cyan', HANDED_OVER: 'success', CANCELLED: 'neutral',
}
export const paymentStatusLabels: Record<PaymentStatus, string> = { PENDING: 'Chưa thanh toán', PAID: 'Đã thanh toán' }
