import { Link } from 'react-router-dom'

export function FinalCta() {
  return <section className="studio-final-cta section-pad studio-reveal"><div className="studio-final-cta__light" aria-hidden="true" /><span className="studio-kicker">Sẵn sàng khi bạn cần</span><h2>Thiết bị của bạn<br />cần được kiểm tra?</h2><p>Bắt đầu bằng thiết bị và vấn đề thực tế. Hệ thống sẽ hiển thị những phương án đang có.</p><div><Link className="studio-button studio-button--light" to="/booking">Đặt lịch sửa chữa <span aria-hidden="true">↗</span></Link><Link className="studio-button studio-button--outline" to="/lookup">Tra cứu dịch vụ <span aria-hidden="true">→</span></Link></div></section>
}
