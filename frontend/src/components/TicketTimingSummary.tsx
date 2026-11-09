import type { ServiceTicketStatus, TicketTiming } from '../api/contracts'
import { countdown } from '../utils/timing'
import { formatDateTime } from '../utils/format'

export function TicketTimingSummary({ timing, status, now }: { timing?: TicketTiming; status: ServiceTicketStatus; now: number }) {
  const isUnassigned = status === 'WAITING_ASSIGNMENT'
  const isAssigned = status === 'ASSIGNED'
  const isActivelyProcessing = ['INSPECTING', 'REPAIRING'].includes(status)
  const due = countdown(timing?.estimatedCompletionAt, timing?.estimatedDurationMinutes, now)

  return (
    <div className="ticket-timing-summary">
      <div>
        <span>Dự kiến bắt đầu</span>
        <strong>{isUnassigned ? 'Chưa phân công' : formatDateTime(timing?.estimatedStartAt)}</strong>
      </div>
      <div>
        <span>Dự kiến sửa xong</span>
        <strong>{isUnassigned ? 'Chờ phân công' : formatDateTime(timing?.estimatedCompletionAt)}</strong>
      </div>

      {/* 1. Khi ĐÃ PHÂN CÔNG nhưng KTV CHƯA BẤM BẮT ĐẦU: Hiển thị thời lượng ML gốc, không đếm ngược hàng đợi */}
      {isAssigned && (
        <p className="timing-countdown timing-countdown--info">
          Chờ kỹ thuật viên bắt đầu · Thời lượng xử lý {timing?.estimatedDurationMinutes ?? 0} phút
        </p>
      )}

      {/* 2. Khi KTV ĐÃ BẤM BẮT ĐẦU XỬ LÝ: Kích hoạt đồng hồ đếm ngược thời gian sửa thực tế */}
      {isActivelyProcessing && (
        <p className={`timing-countdown timing-countdown--${due.tone}`}>
          {due.text}
          {due.tone === 'unknown' && ' · Cần lịch làm việc phù hợp'}
        </p>
      )}

      {/* 3. Khi phiếu tạm dừng (Chờ linh kiện / Chờ duyệt) */}
      {['WAITING_PART', 'WAITING_APPROVAL'].includes(status) && (
        <p className="timing-countdown timing-countdown--warning">
          Tạm dừng · Cập nhật khi tiếp tục xử lý
        </p>
      )}

      {timing?.actualRepairCompletedAt && <p>Đã sửa xong: {formatDateTime(timing.actualRepairCompletedAt)}</p>}
    </div>
  )
}