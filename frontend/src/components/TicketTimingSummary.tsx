import type { ServiceTicketStatus, TicketTiming } from '../api/contracts'
import { countdown } from '../utils/timing'
import { formatDateTime } from '../utils/format'
export function TicketTimingSummary({ timing, status, now }: { timing?: TicketTiming; status: ServiceTicketStatus; now: number }) {
 const done = ['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(status)
 const due = countdown(timing?.estimatedCompletionAt, timing?.estimatedDurationMinutes, now)
 const assignment = countdown(timing?.assignmentDueAt, 15, now)
 return <div className="ticket-timing-summary">
  <div><span>Dự kiến bắt đầu</span><strong>{formatDateTime(timing?.estimatedStartAt)}</strong></div>
  <div><span>Dự kiến sửa xong</span><strong>{formatDateTime(timing?.estimatedCompletionAt)}</strong></div>
  {!done && <p className={`timing-countdown timing-countdown--${due.tone}`}>{due.text}{due.tone === 'unknown' && (['WAITING_PART', 'WAITING_APPROVAL'].includes(status) ? ' · Cập nhật khi tiếp tục xử lý' : ' · Cần lịch làm việc phù hợp')}</p>}
  {status === 'WAITING_ASSIGNMENT' && <p className={`timing-countdown timing-countdown--${assignment.tone}`}><strong>Chưa phân công</strong> · Hạn {formatDateTime(timing?.assignmentDueAt)} · {assignment.tone === 'red' ? `Quá hạn phân công ${Math.abs(assignment.minutes ?? 0)} phút` : assignment.text}</p>}
  {timing?.actualRepairCompletedAt && <p>Đã sửa xong: {formatDateTime(timing.actualRepairCompletedAt)}</p>}
 </div>
}
