import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  ['/', 'Trang chủ'], ['/devices', 'Thiết bị'], ['/lookup', 'Tra cứu'],
] as const

export function PublicLayout() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Đi tới nội dung chính</a>
    <header className={`public-header ${scrolled ? 'public-header--scrolled' : ''}`}>
      <NavLink className="brand" to="/" aria-label="TáoCare — Trang chủ"><span className="brand-mark">T</span><span>TáoCare</span><small>TECHNICAL CARE</small></NavLink>
      <nav aria-label="Điều hướng chính">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav>
      <NavLink className="button button--dark header-cta" to="/booking">Đặt lịch ngay</NavLink>
    </header>
    <main id="main-content"><Outlet /></main>
    <footer className="public-footer"><div className="public-footer__brand"><span className="brand-mark">T</span><div><strong>TáoCare</strong><p>Dịch vụ kỹ thuật độc lập, rõ ràng từ tiếp nhận đến bàn giao.</p></div></div><nav aria-label="Điều hướng chân trang">{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav><small>Thông tin dịch vụ và chi nhánh được cung cấp trực tiếp từ hệ thống vận hành.</small><span className="public-footer__note">Không phải website chính thức của Apple.</span></footer>
  </div>
}
