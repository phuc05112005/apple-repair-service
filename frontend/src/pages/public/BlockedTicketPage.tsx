import { Link, useParams } from 'react-router-dom'

export function BlockedTicketPage() {
  const { ticketCode } = useParams()
  return <div className="blocked-page section-pad"><span className="eyebrow">Phiếu {ticketCode}</span><h1>Vui lòng tra cứu bằng số điện thoại.</h1><p>API public hiện chưa có endpoint lấy một phiếu trực tiếp bằng mã. Để bảo vệ dữ liệu và giữ đúng contract, frontend không thử suy đoán thông tin phiếu.</p><Link className="button button--primary" to="/lookup">Đi tới tra cứu</Link></div>
}
