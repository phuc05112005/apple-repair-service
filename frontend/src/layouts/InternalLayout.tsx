import { NavLink, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from '../auth/useAuth'

const roleConfig: Record<UserRole, { title: string; links: [string, string][] }> = {
  ADMIN: { title: 'Quản trị hệ thống', links: [['', 'Tổng quan'], ['statistics', 'Thống kê'], ['users', 'Tài khoản'], ['branches', 'Chi nhánh'], ['catalog', 'Danh mục dịch vụ'], ['parts', 'Linh kiện'], ['inventory', 'Tồn kho'], ['slots', 'Khung giờ'], ['schedules', 'Lịch kỹ thuật viên'], ['settings', 'Thiết lập']] },
  RECEPTIONIST: { title: 'Vận hành lễ tân', links: [['', 'Tổng quan'], ['appointments', 'Lịch hẹn'], ['intake', 'Tiếp nhận'], ['tickets', 'Phiếu dịch vụ'], ['assignments', 'Phân công'], ['handover', 'Thanh toán & bàn giao']] },
  TECHNICIAN: { title: 'Kỹ thuật viên', links: [['', 'Công việc của tôi']] },
}

export function InternalLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const config = roleConfig[role]
  const base = `/internal/${role.toLowerCase()}`
  return <div className="internal-shell">
    <aside className="internal-sidebar">
      <NavLink className="brand brand--internal" to={base}><span className="brand-mark">T</span><span>TáoCare Ops</span></NavLink>
      <div className="workspace-label">{config.title}</div>
      <nav aria-label={`Điều hướng ${config.title}`}>{config.links.map(([path, label]) => <NavLink key={path} end={!path} to={path ? `${base}/${path}` : base}>{label}</NavLink>)}</nav>
    </aside>
    <div className="internal-main">
      <header className="internal-topbar"><div><span className="eyebrow">Đang đăng nhập</span><strong>{user?.fullName}</strong></div><button className="button button--quiet" onClick={() => logout()}>Đăng xuất</button></header>
      <main className="internal-content"><Outlet /></main>
    </div>
  </div>
}
