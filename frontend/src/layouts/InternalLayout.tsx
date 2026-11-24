import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/contracts'
import { useAuth } from '../auth/useAuth'
import { UserProfileModal } from '../components/UserProfileModal'

interface NavGroup { label: string; links: [string, string, string][] }
const roleConfig: Record<UserRole, { title: string; groups: NavGroup[] }> = {
  ADMIN: {
    title: 'Quản trị hệ thống',
    groups: [
      {
        label: 'Tổng quan',
        links: [
          ['', 'Tổng quan', '⌂'],
          ['statistics', 'Thống kê & Báo cáo', '⌁'],
        ],
      },
      {
        label: 'Vận hành',
        links: [
          ['settings', 'Thời gian & cấu hình', '◷'],
          ['footer-settings', 'Thông tin hệ thống', '☎'],
        ],
      },
      {
        label: 'Nhân sự',
        links: [
          ['users', 'Tài khoản', '◎'],
          ['schedules', 'Lịch làm việc', '◷'],
        ],
      },
      {
        label: 'Danh mục',
        links: [
          ['catalog', 'Dịch vụ', '◇'],
          ['parts', 'Linh kiện', '▣'],
          ['inventory', 'Tồn kho linh kiện', '▤'],
          ['branches', 'Chi nhánh', '⌖'],
          ['slots', 'Khung giờ & lịch hẹn', '◫'],
        ],
      },
    ],
  },
  RECEPTIONIST: {
    title: 'Nhân viên tiếp nhận',
    groups: [
      {
        label: 'Công việc',
        links: [
          ['', 'Tổng quan', '⌂'],
          ['appointments', 'Lịch hẹn', '◫'],
          ['intake', 'Tiếp nhận', '↳'],
          ['warranty-history', 'Lịch sử & bảo hành', '◇'],
          ['tickets', 'Phiếu dịch vụ', '▤'],
        ],
      },
    ],
  },
  TECHNICIAN: {
    title: 'Kỹ thuật viên',
    groups: [
      {
        label: 'Công việc',
        links: [
          ['', 'Công việc', '▤'],
          ['history', 'Lịch sử', '◷'],
        ],
      },
    ],
  },
}

export function InternalLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const config = roleConfig[role]
  const base = `/internal/${role.toLowerCase()}`
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'password' | null>(null)

  const menuOpen = openPath === pathname

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPath(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className="internal-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Đóng menu điều hướng"
          onClick={() => setOpenPath(null)}
        />
      )}

      {/* Sidebar bên trái */}
      <aside className={`internal-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="internal-sidebar__head">
          <NavLink className="brand brand--internal" to={base} onClick={() => setOpenPath(null)}>
            <span className="brand-mark">T</span>
            <span>TáoCare <small>OPS</small></span>
          </NavLink>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Đóng menu"
            onClick={() => setOpenPath(null)}
          >
            ×
          </button>
        </div>

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
                  onClick={() => setOpenPath(null)}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        {/* Khối User góc dưới Sidebar */}
        <button
          type="button"
          className="sidebar-user"
          onClick={() => {
            setOpenPath(null)
            setProfileModalTab('profile')
          }}
          title="Bấm để xem & chỉnh sửa hồ sơ cá nhân"
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
          <div className="internal-topbar__left">
            <button
              type="button"
              className="mobile-menu-button"
              aria-expanded={menuOpen}
              aria-label="Mở menu điều hướng"
              onClick={() => setOpenPath(pathname)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>Menu</span>
            </button>

            <div className="internal-topbar__title">
              <span className="eyebrow">Không gian làm việc</span>
              <strong>{config.title}</strong>
            </div>
          </div>

          <div className="internal-topbar__actions">
            <button
              type="button"
              className="button button--secondary topbar-profile-btn"
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