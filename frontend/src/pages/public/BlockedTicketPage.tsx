import { Link, useParams } from 'react-router-dom'

export function BlockedTicketPage() {
  const { ticketCode } = useParams()
  return <div className="blocked-page section-pad"><span className="eyebrow">Phiếu {ticketCode}</span><h1>Vui lòng tra cứu bằng số điện thoại.</h1><p>Để bảo vệ thông tin của bạn, vui lòng nhập số điện thoại đã dùng khi đăng ký để xem phiếu dịch vụ.</p><Link className="button button--primary" to="/lookup">Đi tới tra cứu</Link></div>
}
