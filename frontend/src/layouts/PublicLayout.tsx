import { NavLink, Outlet } from 'react-router-dom'

const links = [
  ['/', 'Trang chủ'], ['/devices', 'Thiết bị'], ['/booking', 'Đặt lịch sửa chữa'], ['/lookup', 'Tra cứu'],
] as const

export function PublicLayout() {
  return <div className="site-shell">
    <header className="public-header">
      <NavLink className="brand" to="/" aria-label="TáoCare — Trang chủ"><span className="brand-mark">T</span><span>TáoCare</span></NavLink>
      <nav aria-label="Điều hướng chính">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav>
      <NavLink className="button button--dark header-cta" to="/booking">Đặt lịch</NavLink>
    </header>
    <main><Outlet /></main>
    <footer className="public-footer"><div><strong>TáoCare</strong><p>Dịch vụ kỹ thuật minh bạch cho thiết bị của bạn.</p></div><nav aria-label="Điều hướng chân trang">{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav><small>Thông tin dịch vụ và chi nhánh được cung cấp từ hệ thống vận hành.</small></footer>
  </div>
}
