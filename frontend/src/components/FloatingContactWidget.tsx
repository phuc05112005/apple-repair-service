import { useEffect, useState } from 'react'

interface FloatingContactProps {
  hotline: string
  zaloPhone: string
}

export function FloatingContactWidget({ hotline, zaloPhone }: FloatingContactProps) {
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 280)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cleanPhone = hotline.replace(/\s+/g, '')
  const cleanZalo = zaloPhone.replace(/\s+/g, '')

  return (
    <aside className="system-widget-container" aria-label="Kênh hỗ trợ nhanh">
      {/* 1. Nút Back to Top (Lên trên cùng) */}
      <button
        onClick={scrollToTop}
        className={`widget-btn widget-btn--top ${showBackToTop ? 'is-visible' : ''}`}
        aria-label="Cuộn về đầu trang"
        title="Về đầu trang"
      >
        <div className="widget-btn__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </div>
      </button>

      {/* 2. Nút Gọi Điện Hotline */}
      <a
        href={`tel:${cleanPhone}`}
        className="widget-btn widget-btn--call"
        aria-label={`Gọi Hotline: ${hotline}`}
      >
        <span className="radar-pulse"></span>
        <span className="radar-pulse delay"></span>
        <div className="widget-btn__icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </div>
        <div className="widget-btn__label">
          <small>HOTLINE KỸ THUẬT</small>
          <strong>{hotline}</strong>
        </div>
      </a>

      {/* 3. Nút Chat Zalo */}
      <a
        href={`https://zalo.me/${cleanZalo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="widget-btn widget-btn--zalo widget-btn--zalo-pulse"
        aria-label="Chat qua Zalo"
      >
        <div className="widget-btn__icon widget-btn__icon--zalo">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg"
            alt="Zalo"
            width="28"
            height="28"
            className="zalo-official-icon"
          />
        </div>
        <div className="widget-btn__label">
          <small>TƯ VẤN TRỰC TUYẾN</small>
          <strong>Chat Zalo</strong>
        </div>
      </a>
    </aside>
  )
}