import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from '../auth/useAuth'

interface NavGroup { label: string; links: [string, string, string][] }
const roleConfig: Record<UserRole, { title: string; groups: NavGroup[] }> = {
  ADMIN: { title: 'Quản trị hệ thống', groups: [
    { label: 'Tổng quan', links: [['', 'Tổng quan', '⌂'], ['statistics', 'Thống kê', '⌁']] },
    { label: 'Nhân sự', links: [['users', 'Tài khoản', '◎'], ['schedules', 'Lịch làm việc', '◷']] },
    { label: 'Danh mục', links: [['catalog', 'Dịch vụ', '◇'], ['parts', 'Linh kiện', '▣'], ['inventory', 'Tồn kho linh kiện', '▤'], ['branches', 'Chi nhánh', '⌖'], ['slots', 'Khung giờ & lịch hẹn', '◫']] },
  ] },
  RECEPTIONIST: { title: 'Nhân viên tiếp nhận', groups: [{ label: 'Công việc', links: [['', 'Tổng quan', '⌂'], ['appointments', 'Lịch hẹn', '◫'], ['intake', 'Tiếp nhận', '↳'], ['tickets', 'Phiếu dịch vụ', '▤']] }] },
  TECHNICIAN: { title: 'Kỹ thuật viên', groups: [{ label: 'Công việc', links: [['', 'Công việc của tôi', '▤']] }] },
}

export function InternalLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const config = roleConfig[role]
  const base = `/internal/${role.toLowerCase()}`
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="internal-shell">
    <button className="mobile-menu-button" aria-label="Mở menu quản trị" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>☰ <span>Menu</span></button>
    {menuOpen && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`internal-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <NavLink className="brand brand--internal" to={base} onClick={() => setMenuOpen(false)}><span className="brand-mark">T</span><span>TáoCare <small>OPS</small></span></NavLink>
      <div className="workspace-label">{config.title}</div>
      <nav aria-label={`Điều hướng ${config.title}`}>{config.groups.map(group => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.links.map(([path, label, icon]) => <NavLink key={path} end={!path} to={path ? `${base}/${path}` : base} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}</section>)}</nav>
      <div className="sidebar-user"><span>{user?.fullName?.slice(0, 1).toLocaleUpperCase('vi')}</span><div><strong>{user?.fullName}</strong><small>{role === 'ADMIN' ? 'Quản trị viên' : role === 'RECEPTIONIST' ? 'Nhân viên tiếp nhận' : 'Kỹ thuật viên'}</small></div></div>
    </aside>
    <div className="internal-main">
      <header className="internal-topbar"><div><span className="eyebrow">Không gian làm việc</span><strong>{config.title}</strong></div><button className="button button--quiet" onClick={() => logout()}>Đăng xuất</button></header>
      <main className="internal-content" id="main-content"><Outlet /></main>
    </div>
  </div>
}
