import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ServiceTicketResponse } from '../api/contracts'
import { timingApi } from '../api/timingApi'
import { TicketTimingSummary } from './TicketTimingSummary'
import { useBusinessNow } from '../hooks/useBusinessNow'
import { formatDateTime } from '../utils/format'
import { ErrorState, LoadingState } from './AsyncState'
const reasons: Record<string, string> = { CREATED: 'Tiếp nhận', ASSIGNED: 'Phân công', ACTUAL_START: 'Bắt đầu xử lý kỹ thuật', RESUME: 'Tiếp tục xử lý kỹ thuật', SERVICE_PLAN_CHANGE: 'Cập nhật phương án', QUEUE_RECALCULATED: 'Cập nhật hàng đợi', TRANSFER: 'Chuyển kỹ thuật viên', WAITING_PART: 'Chờ linh kiện', WAITING_APPROVAL: 'Chờ liên hệ khách', WAITING_HANDOVER: 'Hoàn tất kỹ thuật', INSPECTING: 'Bắt đầu kiểm tra', CANCELLED: 'Hủy phiếu' }
export function TicketTimingPanel({ ticket, canAdjust = false, canViewHistory = true }: { ticket: ServiceTicketResponse; canAdjust?: boolean; canViewHistory?: boolean }) {
 const now = useBusinessNow(); const client = useQueryClient()
 const [showHistory, setShowHistory] = useState(false)
 const [showManual, setShowManual] = useState(false)
 const [start, setStart] = useState(''); const [completion, setCompletion] = useState(''); const [minutes, setMinutes] = useState(0); const [reason, setReason] = useState('')
 const history = useQuery({ queryKey: ['internal', 'time-estimates', ticket.id], queryFn: ({ signal }) => timingApi.history(ticket.id, signal), enabled: showHistory && canViewHistory })
 const manual = useMutation({ mutationFn: () => timingApi.manual(ticket.id, { estimatedStartAt: start, estimatedCompletionAt: completion, estimatedDurationMinutes: minutes, reason }),
  onSuccess: async () => { setShowManual(false); await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'ticket', ticket.id] }), client.invalidateQueries({ queryKey: ['internal', 'time-estimates', ticket.id] }), client.invalidateQueries({ queryKey: ['internal', 'tickets'] })]) } })
 const timing = ticket.timing
 return <section className="ops-section timing-panel"><div className="ops-section__title"><span>◷</span><h2>Thời gian xử lý</h2></div>
  <TicketTimingSummary timing={timing} status={ticket.status} now={now} />
  <dl className="record-grid"><div><dt>Tiếp nhận</dt><dd>{formatDateTime(ticket.receivedAt)}</dd></div><div><dt>Thời lượng kỹ thuật dự kiến</dt><dd>{timing?.estimatedDurationMinutes == null ? 'Chưa xác định' : `${timing.estimatedDurationMinutes} phút`} · {timing?.estimateSource === 'MANUAL' ? 'Điều chỉnh thủ công' : 'Theo định mức dịch vụ'}</dd></div>
   <div><dt>Dự kiến bắt đầu ban đầu</dt><dd>{formatDateTime(timing?.initialEstimatedStartAt)}</dd></div><div><dt>Dự kiến hoàn thành ban đầu</dt><dd>{formatDateTime(timing?.initialEstimatedCompletionAt)}</dd></div>
   <div><dt>Bắt đầu kỹ thuật thực tế</dt><dd>{formatDateTime(timing?.actualRepairStartedAt)}</dd></div><div><dt>Hoàn tất kỹ thuật</dt><dd>{formatDateTime(timing?.actualRepairCompletedAt)}</dd></div></dl>
  <div className="button-row">{canViewHistory && <button className="button button--quiet" onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Ẩn lịch sử dự kiến' : 'Xem lịch sử dự kiến'}</button>}
    {canAdjust && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED', 'WAITING_PART', 'WAITING_APPROVAL'].includes(ticket.status) && <button className="button button--secondary" onClick={() => { setStart(timing?.estimatedStartAt?.slice(0, 16) ?? ''); setCompletion(timing?.estimatedCompletionAt?.slice(0, 16) ?? ''); setMinutes(timing?.estimatedDurationMinutes ?? 0); setShowManual(!showManual) }}>Điều chỉnh dự kiến</button>}</div>
   {canViewHistory && showHistory && (history.isLoading ? <LoadingState /> : history.isError ? <ErrorState error={history.error} retry={() => history.refetch()} /> : <ol className="history-list">{history.data?.map(h => <li key={h.id}><span /><div><strong>{h.reason.startsWith('MANUAL:') ? `Điều chỉnh: ${h.reason.slice(7)}` : reasons[h.reason] ?? 'Cập nhật thời gian'}</strong><p>{formatDateTime(h.createdAt)} · {formatDateTime(h.estimatedStartAt)} → {formatDateTime(h.estimatedCompletionAt)}</p><small>{h.estimatedDurationMinutes == null ? 'Chưa xác định thời lượng kỹ thuật' : `${h.estimatedDurationMinutes} phút kỹ thuật`} · Nghỉ giữa thiết bị: {h.breakMinutesSnapshot} phút</small></div></li>)}{!history.data?.length && <p>Phiếu cũ chưa có lịch sử dự kiến. Hệ thống không tạo lại mốc thời gian giả.</p>}</ol>)}
  {showManual && <form className="timing-manual-form" onSubmit={event => { event.preventDefault(); manual.mutate() }}><p>Thời gian theo giờ Việt Nam. Dự kiến ban đầu và lịch sử cũ được giữ nguyên.</p><div className="form-grid">
   <label className="field"><span>Dự kiến bắt đầu</span><input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
   <label className="field"><span>Dự kiến hoàn thành</span><input type="datetime-local" required value={completion} onChange={e => setCompletion(e.target.value)} /></label>
    <label className="field"><span>Thời lượng kỹ thuật dự kiến (phút)</span><input type="number" min="1" max="10080" required placeholder="Nhập số phút" value={minutes || ''} onChange={e => setMinutes(Number(e.target.value))} /></label>
   <label className="field"><span>Lý do điều chỉnh</span><textarea required maxLength={5000} placeholder="Nhập lý do thay đổi dự kiến" value={reason} onChange={e => setReason(e.target.value)} /></label></div>
   <button className="button button--primary" disabled={manual.isPending || !reason.trim()}>Lưu dự kiến mới</button></form>}
  {manual.isError && <ErrorState error={manual.error} />}
 </section>
}
