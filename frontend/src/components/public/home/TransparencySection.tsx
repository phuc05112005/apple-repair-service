import { Link } from 'react-router-dom'

export function TransparencySection() {
  return <section className="studio-transparency section-pad studio-reveal">
    <div className="studio-transparency__preview" aria-label="Minh họa cấu trúc phiếu dịch vụ">
      <div className="studio-ticket-window">
        <header><span>PHIẾU DỊCH VỤ</span><i /><i /><i /></header>
        <div className="studio-ticket-window__title"><div><small>Trạng thái hiện tại</small><strong>Đang sửa chữa</strong></div><span>04 / 06</span></div>
        <div className="studio-ticket-window__progress"><i /><i /><i /><i className="active" /><i /><i /></div>
        <div className="studio-ticket-window__rows"><div><span>Phương án</span><strong>Đã ghi nhận</strong></div><div><span>Linh kiện</span><strong>Theo hạng mục</strong></div><div><span>Chi phí</span><strong>Theo phiếu dịch vụ</strong></div><div><span>Bảo hành</span><strong>Sau bàn giao</strong></div></div>
      </div>
      <div className="studio-status-card"><span>Tiến độ</span><strong>Cập nhật theo nghiệp vụ</strong><i /></div>
    </div>
    <div className="studio-transparency__copy"><span className="studio-kicker">Minh bạch trong từng thao tác</span><h2>Bạn luôn biết thiết bị đang ở đâu trong quy trình.</h2><p>Phương án, linh kiện, chi phí, thanh toán, bảo hành và lịch sử được nối liền trong cùng một phiếu dịch vụ.</p><dl><div><dt>Tiến độ</dt><dd>Trạng thái phản ánh bước xử lý thực tế.</dd></div><div><dt>Phê duyệt</dt><dd>Phương án được ghi nhận trước khi thực hiện.</dd></div><div><dt>Chi phí</dt><dd>Từng hạng mục gắn với phiếu dịch vụ.</dd></div><div><dt>Lịch sử</dt><dd>Tra cứu sau khi bàn giao và khi cần bảo hành.</dd></div></dl><Link to="/lookup">Tra cứu dịch vụ <span aria-hidden="true">↗</span></Link></div>
  </section>
}
