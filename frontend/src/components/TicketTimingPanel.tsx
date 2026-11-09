import type { ServiceTicketResponse } from '../api/contracts'
import { TicketTimingSummary } from './TicketTimingSummary'
import { useBusinessNow } from '../hooks/useBusinessNow'

export function TicketTimingPanel({ ticket }: { ticket: ServiceTicketResponse }) {
  const now = useBusinessNow()

  // Ẩn hoàn toàn khối Thời gian xử lý khi chưa phân công kỹ thuật viên
  if (ticket.status === 'WAITING_ASSIGNMENT') {
    return null
  }

  return (
    <section className="ops-section timing-panel">
      <div className="ops-section__title">
        <span>◷</span>
        <h2>Thời gian xử lý</h2>
      </div>

      {/* Hiển thị duy nhất thông tin dự kiến bắt đầu và dự kiến sửa xong */}
      <TicketTimingSummary timing={ticket.timing} status={ticket.status} now={now} />
    </section>
  )
}