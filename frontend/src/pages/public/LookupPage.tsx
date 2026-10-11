import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { publicApi } from '../../api/publicApi'
import type { PublicRepairItemResponse, PublicTicketResponse, ServiceTicketStatus } from '../../api/contracts'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { appointmentStatusLabels, paymentStatusLabels, ticketStatusLabels } from '../../types/labels'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'

const processSteps: { status: ServiceTicketStatus; label: string }[] = [
  { status: 'WAITING_ASSIGNMENT', label: 'Đã tiếp nhận' },
  { status: 'INSPECTING', label: 'Đang kiểm tra' },
  { status: 'REPAIRING', label: 'Đang sửa chữa' },
  { status: 'WAITING_HANDOVER', label: 'Chờ bàn giao' },
  { status: 'HANDED_OVER', label: 'Đã bàn giao' },
]
const stepIndex = (status: ServiceTicketStatus) => processSteps.findIndex(step => step.status === status)

export function LookupPage() {
  const [mode, setMode] = useState<'phone' | 'code'>('phone')
  const [value, setValue] = useState('')
  const [lookup, setLookup] = useState<{ mode: 'phone' | 'code'; value: string }>()
  const phone = lookup?.mode === 'phone' ? lookup.value : ''
  const appointments = useQuery({ queryKey: ['public', 'lookup', 'appointments', phone], queryFn: ({ signal }) => publicApi.appointmentsByPhone(phone, signal), enabled: Boolean(phone) })
  const tickets = useQuery({ queryKey: ['public', 'lookup', 'tickets', lookup], queryFn: ({ signal }) => publicApi.tickets(lookup?.mode === 'phone' ? { phone: lookup.value } : { ticketCode: lookup?.value }, signal), enabled: Boolean(lookup) })
  function submit(event: FormEvent) { event.preventDefault(); if (value.trim()) setLookup({ mode, value: value.trim() }) }

  return <div className="page-shell lookup-page section-pad">
    <header className="page-intro page-intro--compact"><span className="eyebrow">Tra cứu</span><h1>Theo dõi dịch vụ của bạn</h1><p>Xem lịch hẹn, tiến trình xử lý, thời gian dự kiến và thông tin bảo hành bằng dữ liệu thực tế từ phiếu dịch vụ.</p></header>
    <section className="lookup-box"><div className="segmented" role="group" aria-label="Phương thức tra cứu"><button className={mode === 'phone' ? 'active' : ''} onClick={() => setMode('phone')}>Số điện thoại</button><button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>Mã phiếu dịch vụ</button></div><form onSubmit={submit}><label className="field"><span>{mode === 'phone' ? 'Số điện thoại đã đăng ký' : 'Mã phiếu dịch vụ'}</span><div className="search-input"><input value={value} onChange={event => setValue(event.target.value)} inputMode={mode === 'phone' ? 'tel' : 'text'} placeholder={mode === 'phone' ? 'Nhập số điện thoại' : 'Nhập mã phiếu dịch vụ'} /><button className="button button--primary" disabled={!value.trim()}>Tra cứu</button></div></label></form></section>
    {lookup && <div className="lookup-results">{lookup.mode === 'phone' && <section><div className="result-heading"><div><span className="eyebrow">Lịch hẹn</span><h2>Lịch đã đăng ký</h2></div><span>{appointments.data?.length ?? 0} kết quả</span></div>{appointments.isLoading ? <LoadingState /> : appointments.isError ? <ErrorState error={appointments.error} retry={() => appointments.refetch()} /> : !appointments.data?.length ? <EmptyState title="Không tìm thấy lịch hẹn" /> : <div className="appointment-list">{appointments.data.map(item => <article key={item.appointmentId}><div><span className="record-code">LỊCH #{item.appointmentId}</span><h3>{item.branchName}</h3><p>{formatDate(item.date)} · {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}</p><small>Đặt lúc {formatDateTime(item.bookedAt)}</small></div><StatusBadge label={appointmentStatusLabels[item.status]} tone={item.status === 'CANCELLED' || item.status === 'EXPIRED' ? 'danger' : item.status === 'ARRIVED' ? 'success' : 'info'} /></article>)}</div>}</section>}
      <section><div className="result-heading"><div><span className="eyebrow">Phiếu dịch vụ</span><h2>Tiến trình xử lý</h2></div><span>{tickets.data?.length ?? 0} kết quả</span></div>{tickets.isLoading ? <LoadingState /> : tickets.isError ? <ErrorState error={tickets.error} retry={() => tickets.refetch()} /> : !tickets.data?.length ? <EmptyState title="Không tìm thấy phiếu dịch vụ" /> : <div className="ticket-list">{tickets.data.map(ticket => <TicketCard key={ticket.ticketCode} ticket={ticket} phone={phone} />)}</div>}</section></div>}
  </div>
}

function TicketCard({ ticket, phone }: { ticket: PublicTicketResponse; phone?: string }) {
  const [open, setOpen] = useState(false)
  const current = stepIndex(ticket.status)
  const waiting = ticket.status === 'WAITING_APPROVAL' || ticket.status === 'WAITING_PART'
  return <article className="ticket-card"><button className="ticket-card__summary" onClick={() => setOpen(value => !value)} aria-expanded={open}><div><span className="record-code">Mã tra cứu: {ticket.ticketCode}</span><h3>{ticket.deviceModelName}</h3><p>{ticket.branchName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p></div><div><StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticket.status === 'HANDED_OVER' ? 'success' : ticket.status === 'CANCELLED' ? 'danger' : 'info'} /><span className="expand-icon">{open ? '−' : '+'}</span></div></button>{open && <div className="ticket-card__detail"><div className="ticket-meta"><div><span>Thanh toán</span><strong>{paymentStatusLabels[ticket.paymentStatus]}</strong></div><div><span>Tổng đã duyệt</span><strong>{formatMoney(ticket.approvedTotal)}</strong></div><div><span>Dự kiến hoàn thành</span><strong>{ticket.estimatedCompletionAt ? formatDateTime(ticket.estimatedCompletionAt) : 'Chưa có thời gian dự kiến'}</strong></div></div><div className="timeline-public">{processSteps.map((step, index) => <div className={index <= current ? 'complete' : ''} key={step.status}><span /><div><strong>{step.label}</strong><p>{index === 0 ? formatDateTime(ticket.receivedAt) : index === 2 && ticket.actualRepairStartedAt ? formatDateTime(ticket.actualRepairStartedAt) : index === current ? 'Đang cập nhật theo trạng thái thực tế' : 'Chưa thực hiện'}</p></div></div>)}</div>{waiting && <div className="detail-note"><span>{ticket.status === 'WAITING_PART' ? 'Đang chờ linh kiện' : 'Đang liên hệ xác nhận phương án'}</span><p>{ticket.status === 'WAITING_PART' ? 'Kỹ thuật viên sẽ tiếp tục xử lý khi linh kiện sẵn sàng.' : 'Cửa hàng đang liên hệ để xác nhận phương án sửa chữa.'}</p></div>}{ticket.estimatedDurationMinutes && <p className="muted">Thời lượng kỹ thuật dự kiến: {ticket.estimatedDurationMinutes} phút.</p>}<h4>Dịch vụ thực tế</h4><div className="repair-items">{ticket.repairItems.map(item => <RepairItem key={item.repairItemId} item={item} phone={phone} />)}</div>{ticket.status === 'HANDED_OVER' && <FeedbackForm ticketCode={ticket.ticketCode} phone={phone} />}</div>}</article>
}

function RepairItem({ item, phone }: { item: PublicRepairItemResponse; phone?: string }) {
  const warranty = useQuery({ queryKey: ['public', 'warranty', phone, item.repairItemId], queryFn: ({ signal }) => publicApi.warrantyEligibility(phone!, item.repairItemId, signal), enabled: Boolean(phone && item.warrantyStartDate && item.warrantyEndDate) })
  const warrantyBooking = `/booking?warrantySourceItem=${item.repairItemId}`
  return <div><div><strong>{item.name}</strong><span>{formatMoney(item.finalPrice)}</span></div>{item.partName && <p>{item.partName} · {[item.partBrand, item.partVariant].filter(Boolean).join(' · ')}</p>}{item.warrantyStartDate && <p>{!phone ? 'Tra cứu bằng số điện thoại để kiểm tra bảo hành' : warranty.isLoading ? 'Đang kiểm tra bảo hành…' : warranty.data?.eligible ? `Còn bảo hành ${warranty.data.remainingDays} ngày` : 'Đã hết bảo hành'}</p>}{warranty.data?.eligible && <Link className="text-action" to={warrantyBooking} state={{ warrantyPhone: phone }}>Đặt lịch bảo hành</Link>}</div>
}

function FeedbackForm({ ticketCode, phone }: { ticketCode: string; phone?: string }) {
  const [satisfied, setSatisfied] = useState<boolean>()
  const [comment, setComment] = useState('')
  const feedback = useMutation({ mutationFn: () => publicApi.feedback(ticketCode, { phone: phone!, satisfied: satisfied!, comment: comment.trim() || undefined }) })
  if (!phone) return <p>Tra cứu bằng số điện thoại để gửi phản hồi.</p>
  if (feedback.isSuccess) return <div className="feedback-success">Cảm ơn bạn đã gửi phản hồi.</div>
  return <div className="feedback"><h4>Trải nghiệm dịch vụ của bạn thế nào?</h4><div className="button-row"><button className={`button button--secondary ${satisfied === true ? 'selected' : ''}`} onClick={() => setSatisfied(true)}>Hài lòng</button><button className={`button button--secondary ${satisfied === false ? 'selected' : ''}`} onClick={() => setSatisfied(false)}>Chưa hài lòng</button></div><label className="field"><span>Chia sẻ thêm <i>Không bắt buộc</i></span><textarea placeholder="Nhập chia sẻ về trải nghiệm của bạn" maxLength={5000} value={comment} onChange={event => setComment(event.target.value)} /></label>{feedback.isError && <ErrorState error={feedback.error} />}<button className="button button--primary" disabled={satisfied === undefined || feedback.isPending} onClick={() => feedback.mutate()}>{feedback.isPending ? 'Đang gửi…' : 'Gửi phản hồi'}</button></div>
}
