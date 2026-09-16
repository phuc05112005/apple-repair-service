import type { PointerEvent } from 'react'
import { Link } from 'react-router-dom'

export function PremiumHero() {
  function moveScene(event: PointerEvent<HTMLElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2
    event.currentTarget.style.setProperty('--pointer-x', `${x.toFixed(3)}`)
    event.currentTarget.style.setProperty('--pointer-y', `${y.toFixed(3)}`)
  }

  return <section className="studio-hero section-pad" onPointerMove={moveScene}>
    <div className="studio-hero__grid" aria-hidden="true" />
    <div className="studio-hero__copy">
      <span className="studio-kicker"><i /> Dịch vụ kỹ thuật độc lập</span>
      <h1>Dịch vụ sửa chữa thiết bị Apple, <em>chuyên nghiệp trong từng bước xử lý.</em></h1>
      <p>Chọn đúng thiết bị, xem phương án đang có và theo dõi toàn bộ hành trình sửa chữa trong một trải nghiệm liền mạch.</p>
      <div className="studio-hero__actions">
        <Link className="studio-button studio-button--primary" to="/booking">Đặt lịch sửa chữa <span aria-hidden="true">↗</span></Link>
        <Link className="studio-button studio-button--quiet" to="/lookup">Tra cứu dịch vụ <span aria-hidden="true">→</span></Link>
      </div>
      <div className="studio-hero__note"><span aria-hidden="true" /><p>Phương án và chi phí được ghi nhận trước khi thực hiện.</p></div>
    </div>
    <div className="studio-device-scene">
      <div className="studio-device-scene__halo" aria-hidden="true" />
      <div className="studio-device-scene__orbit studio-device-scene__orbit--one" aria-hidden="true" />
      <div className="studio-device-scene__orbit studio-device-scene__orbit--two" aria-hidden="true" />
      <img src="/images/premium-device-studio.png" alt="Bộ thiết bị gồm điện thoại, máy tính bảng, máy tính xách tay, đồng hồ và tai nghe" width="1200" height="1200" fetchPriority="high" />
      <div className="studio-scene-label studio-scene-label--top"><span>01</span><p>Thiết bị</p><strong>Được nhận diện đúng</strong></div>
      <div className="studio-scene-label studio-scene-label--bottom"><span>02</span><p>Tiến trình</p><strong>Luôn có thể tra cứu</strong></div>
    </div>
    <a className="studio-hero__scroll" href="#supported-devices"><span>Cuộn để khám phá</span><i aria-hidden="true" /></a>
  </section>
}
