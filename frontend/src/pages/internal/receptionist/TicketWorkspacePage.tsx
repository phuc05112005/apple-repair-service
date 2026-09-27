import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { receptionistApi } from '../../../api/receptionistApi'
import type { ApprovalStatus, AssignmentSource, ConfirmationMethod, PaymentMethod } from '../../../api/contracts'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { ConfirmationFields } from '../../../components/ConfirmationFields'
import { StatusBadge } from '../../../components/StatusBadge'
import { TicketTimingPanel } from '../../../components/TicketTimingPanel'
import { confirmationLabels, paymentStatusLabels, ticketStatusLabels, ticketStatusTones } from '../../../types/labels'
import { businessDateTimeInput, formatClock, formatDateTime, formatMoney } from '../../../utils/format'

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' }, { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CARD', label: 'Thẻ' }, { value: 'OTHER', label: 'Khác' },
]

export function TicketWorkspacePage() {
  const id = Number(useParams().ticketId)
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['internal', 'ticket', id], queryFn: ({ signal }) => receptionistApi.ticket(id, signal), enabled: Number.isInteger(id) && id > 0 })
  const ticket = detail.data?.ticket
  const recommendations = useQuery({ queryKey: ['internal', 'recommendations', id], queryFn: ({ signal }) => receptionistApi.recommendations(id, signal), enabled: ticket?.status === 'WAITING_ASSIGNMENT' })
  const paymentSummary = useQuery({ queryKey: ['internal', 'payment-summary', id], queryFn: ({ signal }) => receptionistApi.paymentSummary(id, signal), enabled: ticket?.status === 'WAITING_HANDOVER' })
  const [methodByItem, setMethodByItem] = useState<Record<number, ConfirmationMethod | ''>>({})
  const [noteByItem, setNoteByItem] = useState<Record<number, string>>({})
  const [approvalResolvedAt, setApprovalResolvedAt] = useState(() => businessDateTimeInput())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cancelReason, setCancelReason] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }),
      queryClient.invalidateQueries({ queryKey: ['internal', 'recommendations', id] }),
      queryClient.invalidateQueries({ queryKey: ['internal', 'payment-summary', id] }),
    ])
  }

  const assign = useMutation({ mutationFn: ({ technicianId, source }: { technicianId: number; source: AssignmentSource }) => receptionistApi.assign(id, technicianId, source), onSuccess: refresh })
  const approval = useMutation({ mutationFn: ({ itemId, decision }: { itemId: number; decision: ApprovalStatus }) => receptionistApi.approval(itemId, decision, noteByItem[itemId], methodByItem[itemId] || undefined, approvalResolvedAt || undefined), onSuccess: refresh })
  const pay = useMutation({ mutationFn: () => receptionistApi.payment(id, paymentMethod), onSuccess: refresh })
  const settle = useMutation({ mutationFn: () => receptionistApi.settleZero(id), onSuccess: refresh })
  const handover = useMutation({ mutationFn: () => receptionistApi.handover(id), onSuccess: refresh })
  const cancel = useMutation({ mutationFn: () => receptionistApi.cancelTicket(id, cancelReason), onSuccess: refresh })

  if (!Number.isInteger(id) || id <= 0) return <ErrorState error={new Error('Mã phiếu không hợp lệ')} />
  if (detail.isLoading) return <LoadingState label="Đang tải phiếu dịch vụ…" />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => detail.refetch()} />
  if (!detail.data || !ticket) return <EmptyState title="Không tìm thấy phiếu" />

  const context = detail.data.context
  const hasPendingApproval = detail.data.repairItems.some(item => item.approvalStatus === 'PENDING')
  const pendingError = assign.error ?? approval.error ?? pay.error ?? settle.error ?? handover.error ?? cancel.error

  return <div className="workspace-page ticket-workspace">
    <header className="ticket-header"><div><span className="record-code">Phiếu #{ticket.id}</span><h1>Phiếu dịch vụ</h1><p>{context.branchName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p></div><StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticketStatusTones[ticket.status]} /></header>
    <div className="ticket-reference"><div><span>Mã tra cứu phiếu</span><code>{ticket.ticketCode}</code><small>Dùng mã này khi khách hàng tra cứu phiếu dịch vụ.</small></div><button type="button" className="button button--quiet" onClick={async () => { try { await navigator.clipboard.writeText(ticket.ticketCode); setCopiedCode(true) } catch { setCopiedCode(false) } }}>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</button></div>
    <div className="ticket-milestones"><div><span>Tiếp nhận</span><strong>{formatDateTime(ticket.receivedAt)}</strong></div><div><span>Cập nhật gần nhất</span><strong>{formatDateTime(ticket.updatedAt)}</strong></div>{ticket.paidAt && <div><span>Thanh toán</span><strong>{formatDateTime(ticket.paidAt)}</strong></div>}{ticket.handedOverAt && <div><span>Bàn giao</span><strong>{formatDateTime(ticket.handedOverAt)}</strong></div>}</div>
    <TicketTimingPanel ticket={ticket} canAdjust />
    <div className="ticket-layout"><main>
      <section className="ops-section"><div className="ops-section__title"><span>01</span><h2>Thông tin tiếp nhận</h2></div><dl className="record-grid"><div><dt>Khách hàng</dt><dd>{context.customerFullName}<br /><small>{context.customerPhone}</small></dd></div><div><dt>Thiết bị</dt><dd>{context.deviceModelName}<br /><small>{context.deviceTypeName}{context.storage ? ` · ${context.storage}` : ''}</small></dd></div><div><dt>Vấn đề</dt><dd>{context.serviceIssues.join(', ') || 'Chưa xác định'}</dd></div><div><dt>Thanh toán</dt><dd>{paymentStatusLabels[ticket.paymentStatus]}</dd></div></dl>{context.symptomDescription && <div className="detail-note"><span>Vấn đề khách mô tả ban đầu</span><p>{context.symptomDescription}</p></div>}<div className="detail-note"><span>Tình trạng khi nhận</span><p>{ticket.receivedCondition}</p></div>{ticket.inspectionResult && <div className="detail-note"><span>Kết quả kiểm tra</span><p>{ticket.inspectionResult}</p></div>}</section>

      <section className="ops-section"><div className="ops-section__title"><span>02</span><h2>Hạng mục xử lý</h2></div>{ticket.status === 'WAITING_APPROVAL' && hasPendingApproval && <label className="field"><span>Khách phản hồi lúc</span><input type="datetime-local" max={businessDateTimeInput()} value={approvalResolvedAt} onChange={event => setApprovalResolvedAt(event.target.value)} /></label>}<div className="repair-admin-list">{detail.data.repairItems.map(item => <article key={item.id}><div><span>Hạng mục #{item.id}</span><h3>{item.itemNameSnapshot}</h3>{item.confirmationMethod && <small>{confirmationLabels[item.confirmationMethod]} · phản hồi lúc {formatDateTime(item.approvalResolvedAt)} · ghi nhận lúc {formatDateTime(item.approvalDecisionAt)}{item.approvalNote ? ` · ${item.approvalNote}` : ''}</small>}<p>{formatMoney(item.basePrice)} → <strong>{formatMoney(item.finalPrice)}</strong></p></div><StatusBadge label={item.approvalStatus === 'PENDING' ? 'Chờ duyệt' : item.approvalStatus === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} tone={item.approvalStatus === 'APPROVED' ? 'success' : item.approvalStatus === 'REJECTED' ? 'danger' : 'warning'} />{ticket.status === 'WAITING_APPROVAL' && item.approvalStatus === 'PENDING' && <div className="approval-actions"><ConfirmationFields method={methodByItem[item.id] ?? ''} note={noteByItem[item.id] ?? ''} scope={ticket.authorizedScope} onMethod={value => setMethodByItem(current => ({ ...current, [item.id]: value }))} onNote={value => setNoteByItem(current => ({ ...current, [item.id]: value }))} /><div className="button-row"><button className="button button--primary" disabled={approval.isPending || !methodByItem[item.id] || !approvalResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'APPROVED' })}>Ghi nhận khách đồng ý</button><button className="button button--quiet" disabled={approval.isPending || !methodByItem[item.id] || !approvalResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'REJECTED' })}>Ghi nhận khách từ chối</button></div></div>}</article>)}</div></section>

      <section className="ops-section"><div className="ops-section__title"><span>03</span><h2>Lịch sử trạng thái</h2></div><ol className="history-list">{detail.data.history.map(event => <li key={event.id}><span /><div><strong>{ticketStatusLabels[event.toStatus]}</strong><p><time dateTime={event.changedAt}>{formatDateTime(event.changedAt)}</time>{event.note ? ` · ${event.note === 'Intake' ? 'Tiếp nhận thiết bị' : event.note}` : ''}</p>{event.resolvedAt && <small>Điều kiện chờ kết thúc lúc {formatDateTime(event.resolvedAt)} · ghi nhận lúc {formatDateTime(event.resolutionRecordedAt)}{event.resolutionNote ? ` · ${event.resolutionNote}` : ''}</small>}</div></li>)}</ol></section>
    </main><aside className="action-rail"><h2>Việc cần làm tiếp theo</h2>
      {ticket.status === 'WAITING_ASSIGNMENT' && <section><h3>Phân công kỹ thuật viên</h3>{recommendations.isLoading ? <LoadingState /> : recommendations.isError ? <ErrorState error={recommendations.error} retry={() => recommendations.refetch()} /> : !recommendations.data?.length ? <EmptyState title="Không có kỹ thuật viên trong ca hiện tại" /> : recommendations.data.map(person => <article className="recommendation" key={person.technicianId}><div><strong>{person.technicianName}</strong><StatusBadge label={person.eligible ? 'Phù hợp ca' : 'Ngoài khả năng ca'} tone={person.eligible ? 'success' : 'warning'} /></div><p>Khối lượng công việc {person.estimatedWorkloadMinutes} phút · Rảnh dự kiến {formatClock(person.estimatedAvailableAt)}</p><button className="button button--primary" disabled={!person.eligible || assign.isPending} onClick={() => assign.mutate({ technicianId: person.technicianId, source: 'ACCEPTED_RECOMMENDATION' })}>Chọn kỹ thuật viên</button></article>)}</section>}
      {ticket.status === 'WAITING_APPROVAL' && <div className="phase-notice phase-notice--warning"><strong>{hasPendingApproval ? 'Chờ quyết định khách hàng' : 'Đã xác nhận – chờ kỹ thuật viên tiếp tục xử lý'}</strong><p>{hasPendingApproval ? 'Ghi nhận phản hồi cho từng hạng mục ở phần bên trái.' : 'Phiếu vẫn ở trạng thái chờ và chưa tự động chuyển sang đang sửa.'}</p></div>}
      {ticket.status === 'WAITING_HANDOVER' && <section><h3>Thanh toán & bàn giao</h3>{paymentSummary.isLoading ? <LoadingState /> : paymentSummary.isError ? <ErrorState error={paymentSummary.error} retry={() => paymentSummary.refetch()} /> : paymentSummary.data && <div className="payment-box"><span>Tổng cần thanh toán</span><strong>{formatMoney(paymentSummary.data.totalAmount)}</strong><p>{paymentStatusLabels[paymentSummary.data.paymentStatus]}</p>{paymentSummary.data.paymentStatus === 'PENDING' && paymentSummary.data.totalAmount > 0 && <><label className="field"><span>Phương thức</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map(method => <option value={method.value} key={method.value}>{method.label}</option>)}</select></label><button className="button button--primary" disabled={pay.isPending} onClick={() => pay.mutate()}>Ghi nhận thanh toán</button></>}{paymentSummary.data.paymentStatus === 'PENDING' && paymentSummary.data.totalAmount === 0 && <button className="button button--primary" disabled={settle.isPending} onClick={() => settle.mutate()}>Quyết toán 0 đồng</button>}{paymentSummary.data.paymentStatus === 'PAID' && <button className="button button--primary" disabled={handover.isPending} onClick={() => handover.mutate()}>Xác nhận bàn giao</button>}</div>}</section>}
      {!['HANDED_OVER', 'CANCELLED'].includes(ticket.status) && <section className="danger-zone"><h3>Hủy phiếu</h3><label className="field"><span>Lý do</span><textarea placeholder="Nhập lý do hủy phiếu" value={cancelReason} onChange={event => setCancelReason(event.target.value)} /></label><button className="button button--quiet" disabled={!cancelReason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>Hủy phiếu dịch vụ</button></section>}
      {pendingError && <ErrorState error={pendingError} />}
    </aside></div>
  </div>
}
