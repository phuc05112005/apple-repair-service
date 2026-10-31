import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSystemSettings } from '../hooks/useSystemSettings'
import { FloatingContactWidget } from '../components/FloatingContactWidget'

const navLinks = [
  ['/', 'Trang chủ'],
  ['/devices', 'Thiết bị & Dịch vụ'],
  ['/lookup', 'Tra cứu'],
] as const

export function PublicLayout() {
  const { settings } = useSystemSettings()
  const [scrolled, setScrolled] = useState(false)
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  const dbLogo = settings.logoUrl?.trim()
  let logoSrc: string | null = null

  if (dbLogo && !failedUrls[dbLogo]) {
    logoSrc = dbLogo
  } else if (!failedUrls['/logo.png']) {
    logoSrc = '/logo.png'
  }

  const handleLogoError = (src: string) => {
    setFailedUrls(prev => ({ ...prev, [src]: true }))
  }

  const cleanPhone = settings.hotline.replace(/\s+/g, '')

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Đi tới nội dung chính</a>
      
      {/* HEADER */}
      <header 
        className={`public-header ${scrolled ? 'public-header--scrolled' : ''}`}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 2.5rem',
          backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.96)' : '#f8fafc',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* LOGO & BRAND TITLE */}
        <NavLink 
          className="brand" 
          to="/" 
          aria-label="TáoCare — Trang chủ"
        >
          {logoSrc ? (
            <img
              key={logoSrc}
              src={logoSrc}
              alt="TáoCare"
              className="brand-logo-img"
              style={{ 
                height: '38px', 
                width: '38px', 
                objectFit: 'contain', 
                borderRadius: '9px',
                flexShrink: 0,
                display: 'block'
              }}
              onError={() => handleLogoError(logoSrc)}
            />
          ) : (
            <span 
              className="brand-mark" 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                flexShrink: 0
              }}
            >
              T
            </span>
          )}
          
          <div className="brand-text">
            <strong>Táo Care</strong>
            <small>Hệ thống sửa chữa thiết bị Apple</small>
          </div>
        </NavLink>

        {/* 3 ĐIỀU HƯỚNG CĂN GIỮA TRANG */}
        <nav 
          aria-label="Điều hướng chính"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '2.25rem',
          }}
        >
          {navLinks.map(([to, label]) => (
            <NavLink 
              key={to} 
              to={to} 
              end={to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* CỤM HOTLINE & NÚT ĐẶT LỊCH */}
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', zIndex: 2 }}>
          <a 
            href={`tel:${cleanPhone}`} 
            className="header-hotline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textDecoration: 'none' }}
          >
            <span 
              className="hotline-icon-svg"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <small style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Hotline hỗ trợ</small>
              <strong style={{ fontSize: '0.925rem', color: '#0284c7', fontWeight: 700 }}>{settings.hotline}</strong>
            </div>
          </a>

          <NavLink 
            className="button button--dark header-cta" 
            to="/booking"
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            Đặt lịch ngay
          </NavLink>
        </div>
      </header>

      <main id="main-content">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="public-footer">
        <div className="public-footer__grid">
          
          {/* CỘT 1: THƯƠNG HIỆU & HOTLINE */}
          <div className="footer-col footer-col--brand">
            <div className="public-footer__brand" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {logoSrc ? (
                <img
                  key={logoSrc}
                  src={logoSrc}
                  alt="TáoCare"
                  className="brand-logo-img"
                  style={{ height: '34px', width: '34px', objectFit: 'contain', flexShrink: 0 }}
                  onError={() => handleLogoError(logoSrc)}
                />
              ) : (
                <span className="brand-mark">T</span>
              )}
              <div className="brand-title-wrap">
                <strong style={{ fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.01em', margin: 0 }}>TáoCare</strong>
                <small style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Hệ thống sửa chữa thiết bị Apple
                </small>
              </div>
            </div>
            
            <p className="footer-desc" style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              {settings.footerDesc || 'Hệ thống sửa chữa & bảo hành thiết bị Apple chuyên nghiệp, minh bạch từ khâu tiếp nhận, chẩn đoán đến bàn giao.'}
            </p>

            <div className="footer-hotline-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.2rem' }}>
                Hotline liên hệ tư vấn:
              </span>
              <strong style={{ fontSize: '1.35rem', color: '#38bdf8', display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>
                {settings.hotline}
              </strong>
              <small style={{ color: '#64748b', fontSize: '0.8rem', display: 'block' }}>
                Giờ trực tổng đài: {settings.workingHours}
              </small>
            </div>
          </div>

          {/* CỘT 2: DANH MỤC */}
          <div className="footer-col">
            <h3 style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f8fafc', marginBottom: '1.25rem', fontWeight: 600 }}>
              DANH MỤC
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><NavLink to="/" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Trang chủ hệ thống</NavLink></li>
              <li><NavLink to="/devices" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Dịch vụ sửa chữa</NavLink></li>
              <li><NavLink to="/lookup" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Tra cứu dịch vụ</NavLink></li>
              <li><NavLink to="/booking" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>Đặt lịch sửa chữa</NavLink></li>
            </ul>
          </div>

          {/* CỘT 3 & 4: CHI NHÁNH CỬA HÀNG */}
          <div className="footer-col footer-col--branches" style={{ gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f8fafc', marginBottom: '1.25rem', fontWeight: 600 }}>
              CHI NHÁNH HỆ THỐNG CÁC CỬA HÀNG
            </h3>
            
            <div className="footer-branch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              {settings.branches.map((branch) => {
                const cleanBranchPhone = branch.phone ? branch.phone.replace(/\s+/g, '') : ''
                return (
                  <div key={branch.id} className="footer-branch-item" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.9rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#f1f5f9', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      {branch.name}
                    </strong>
                    <p style={{ fontSize: '0.825rem', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 0.65rem 0' }}>
                      {branch.address}
                    </p>
                    
                    <div className="branch-meta-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px dotted rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                      {branch.phone && (
                        <a href={`tel:${cleanBranchPhone}`} className="branch-phone-link" style={{ fontSize: '0.825rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                          Liên hệ: {branch.phone}
                        </a>
                      )}
                      <span className="branch-time-badge" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {branch.workingHours}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* BOTTOM BAR */}
        <div className="public-footer__bottom">
          <small style={{ color: '#64748b', fontSize: '0.8rem' }}>© 2026 Táo Care</small>
          <span className="public-footer__note" style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Email: {settings.email} | Trung tâm dịch vụ sửa chữa thiết bị Apple.
          </span>
        </div>
      </footer>

      <FloatingContactWidget hotline={settings.hotline} zaloPhone={settings.zaloPhone} />
    </div>
  )
}