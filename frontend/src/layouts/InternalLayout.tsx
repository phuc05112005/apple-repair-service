import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from '../auth/useAuth'
import { UserProfileModal } from '../components/UserProfileModal'

interface NavGroup { label: string; links: [string, string, string][] }
const roleConfig: Record<UserRole, { title: string; groups: NavGroup[] }> = {
  ADMIN: { title: 'Quản trị hệ thống', groups: [
    { label: 'Tổng quan', links: [['', 'Tổng quan', '⌂'], ['statistics', 'Thống kê & phản hồi', '⌁'], ['ml', 'Giám sát ML', '◇']] },
    { label: 'Vận hành', links: [['settings', 'Thời gian & cấu hình', '◷']] },
    { label: 'Nhân sự', links: [['users', 'Tài khoản', '◎'], ['schedules', 'Lịch làm việc', '◷']] },
    { label: 'Danh mục', links: [['catalog', 'Dịch vụ', '◇'], ['parts', 'Linh kiện', '▣'], ['inventory', 'Tồn kho linh kiện', '▤'], ['branches', 'Chi nhánh', '⌖'], ['slots', 'Khung giờ & lịch hẹn', '◫']] },
  ] },
  RECEPTIONIST: { title: 'Nhân viên tiếp nhận', groups: [{ label: 'Công việc', links: [['', 'Tổng quan', '⌂'], ['appointments', 'Lịch hẹn', '◫'], ['intake', 'Tiếp nhận', '↳'], ['warranty-history', 'Lịch sử & bảo hành', '◇'], ['tickets', 'Phiếu dịch vụ', '▤']] }] },
  TECHNICIAN: { title: 'Kỹ thuật viên', groups: [{ label: 'Công việc', links: [['', 'Công việc của tôi', '▤']] }] },
}

export function InternalLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const config = roleConfig[role]
  const base = `/internal/${role.toLowerCase()}`
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'password' | null>(null)

  return (
    <div className="internal-shell">
      <button
        className="mobile-menu-button"
        aria-label="Mở menu quản trị"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(value => !value)}
      >
        ☰ <span>Menu</span>
      </button>
      
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar bên trái */}
      <aside className={`internal-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <NavLink className="brand brand--internal" to={base} onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">T</span>
          <span>TáoCare <small>OPS</small></span>
        </NavLink>

        <div className="workspace-label">{config.title}</div>

        <nav aria-label={`Điều hướng ${config.title}`}>
          {config.groups.map(group => (
            <section className="nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.links.map(([path, label, icon]) => (
                <NavLink
                  key={path}
                  end={!path}
                  to={path ? `${base}/${path}` : base}
                  onClick={() => setMenuOpen(false)}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        {/* Khối User góc dưới Sidebar có hiệu ứng hover & bấm xem Hồ sơ */}
        <button
          type="button"
          className="sidebar-user"
          onClick={() => setProfileModalTab('profile')}
          title="Bấm để xem & chỉnh sửa hồ sơ cá nhân"
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid #29302c',
            cursor: 'pointer',
            padding: '0.85rem 0.5rem',
            borderRadius: '8px',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#25302a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{user?.fullName?.slice(0, 1).toLocaleUpperCase('vi') || 'U'}</span>
          <div>
            <strong>{user?.fullName}</strong>
            <small>
              {role === 'ADMIN'
                ? 'Quản trị viên'
                : role === 'RECEPTIONIST'
                ? 'Nhân viên tiếp nhận'
                : 'Kỹ thuật viên'}
            </small>
          </div>
        </button>
      </aside>

      {/* Nội dung chính bên phải */}
      <div className="internal-main">
        <header className="internal-topbar">
          <div>
            <span className="eyebrow">Không gian làm việc</span>
            <strong>{config.title}</strong>
          </div>

          {/* Cụm nút bấm chuẩn Design System */}
          <div className="page-action-group">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setProfileModalTab('profile')}
            >
              Hồ sơ cá nhân
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => logout()}
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="internal-content" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Modal quản lý tài khoản */}
      {profileModalTab && (
        <UserProfileModal
          initialTab={profileModalTab}
          onClose={() => setProfileModalTab(null)}
        />
      )}
    </div>
  )
}