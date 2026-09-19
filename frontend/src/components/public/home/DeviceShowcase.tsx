import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { PublicNamedResponse } from '../../../api/contracts'

type DeviceQuery = UseQueryResult<PublicNamedResponse[], Error>

export function DeviceShowcase({ query }: { query: DeviceQuery }) {
  return <section className="studio-devices section-pad studio-reveal" id="supported-devices">
    <header className="studio-section-heading studio-section-heading--split">
      <div><span className="studio-kicker">Thiết bị được hỗ trợ</span><h2>Những thiết bị quen thuộc.<br />Một chuẩn chăm sóc thống nhất.</h2></div>
      <p>Tên thiết bị và đường dẫn được lấy trực tiếp từ danh mục đang hoạt động.</p>
    </header>
    {query.isLoading ? <div className="studio-loading">Đang tải thiết bị…</div> : query.isError ? <div className="studio-error">Không thể tải danh sách thiết bị.</div> : <div className="studio-device-grid">{query.data?.map((device, index) => {
      const kind = deviceKind(device.name)
      return <Link className={`studio-device-card studio-device-card--${kind}`} to={`/devices?type=${device.id}`} key={device.id}>
        <div className="studio-device-card__meta"><span>{String(index + 1).padStart(2, '0')}</span><i aria-hidden="true">↗</i></div>
        <DeviceMiniature kind={kind} />
        <div className="studio-device-card__copy"><strong>{device.name}</strong><small>{deviceDescription(kind)}</small></div>
      </Link>
    })}</div>}
  </section>
}

function DeviceMiniature({ kind }: { kind: string }) {
  if (kind === 'laptop') return <span className="studio-miniature studio-miniature--laptop" aria-hidden="true"><i className="screen" /><i className="deck" /><i className="keyboard" /><i className="trackpad" /></span>
  if (kind === 'tablet') return <span className="studio-miniature studio-miniature--tablet" aria-hidden="true"><i className="glass" /><i className="edge" /></span>
  if (kind === 'watch') return <span className="studio-miniature studio-miniature--watch" aria-hidden="true"><i className="strap" /><i className="face" /><i className="crown" /></span>
  if (kind === 'earbuds') return <span className="studio-miniature studio-miniature--earbuds" aria-hidden="true"><svg viewBox="0 0 300 250" focusable="false"><defs><linearGradient id="earbud-shell" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".48" stopColor="#f4f6f3"/><stop offset="1" stopColor="#b7bfba"/></linearGradient><linearGradient id="earbud-case" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".45" stopColor="#f5f7f4"/><stop offset="1" stopColor="#bbc4bd"/></linearGradient><linearGradient id="earbud-lid" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f8faf8"/><stop offset="1" stopColor="#c4ccc6"/></linearGradient><filter id="earbud-shadow" x="-30%" y="-40%" width="170%" height="200%"><feDropShadow dx="12" dy="17" stdDeviation="12" floodColor="#18221b" floodOpacity=".23"/></filter></defs><ellipse cx="160" cy="225" rx="103" ry="15" fill="#26362b" opacity=".13"/><g filter="url(#earbud-shadow)"><path d="M70 140c0-19 16-34 36-34h110c20 0 36 15 36 34v38c0 26-18 44-44 44H114c-26 0-44-18-44-44z" fill="url(#earbud-case)" stroke="#adb7b0" strokeWidth="1.3"/><path d="M70 144c14 4 39 6 90 6s79-2 92-6" fill="none" stroke="#aeb8b1" strokeWidth="2"/><path d="M73 139c1-31 24-49 53-49h69c30 0 53 18 54 49-20 6-57 8-89 8s-67-2-87-8z" fill="url(#earbud-lid)" stroke="#c8d0ca" strokeWidth="1.4"/><path d="M89 124c12-16 27-21 50-22" fill="none" stroke="#fff" strokeWidth="3" opacity=".8"/><circle cx="160" cy="174" r="2.7" fill="#aab5ac"/></g><g filter="url(#earbud-shadow)"><path d="M102 74c-6 13-4 35 4 40l4 40c1 13 6 20 13 20s11-6 10-17l-4-45c10-7 14-17 12-29-2-14-12-22-24-22-7 0-12 4-15 13z" fill="url(#earbud-shell)" stroke="#b5beb7" strokeWidth="1.2"/><path d="M91 78c-2-11 6-22 19-26 15-5 30 1 32 13 2 10-5 17-18 23-10 4-16 12-24 9-5-2-8-9-9-19z" fill="url(#earbud-shell)" stroke="#b8c1ba" strokeWidth="1.2"/><path d="M94 72c1-6 8-10 14-9 5 1 8 5 8 11-1 5-5 10-11 11-7 1-12-4-11-13z" fill="#343c38"/><path d="M111 145l2 11c1 7 4 10 9 10" fill="none" stroke="#fff" strokeWidth="2" opacity=".8"/><path d="M121 166h11" stroke="#8d9991" strokeWidth="3" strokeLinecap="round"/></g><g filter="url(#earbud-shadow)"><path d="M197 73c6 13 4 35-4 40l-4 40c-1 13-6 20-13 20s-11-6-10-17l4-45c-10-7-14-17-12-29 2-14 12-22 24-22 7 0 12 4 15 13z" fill="url(#earbud-shell)" stroke="#b5beb7" strokeWidth="1.2"/><path d="M208 77c2-11-6-22-19-26-15-5-30 1-32 13-2 10 5 17 18 23 10 4 16 12 24 9 5-2 8-9 9-19z" fill="url(#earbud-shell)" stroke="#b8c1ba" strokeWidth="1.2"/><path d="M205 71c-1-6-8-10-14-9-5 1-8 5-8 11 1 5 5 10 11 11 7 1 12-4 11-13z" fill="#343c38"/><path d="M188 144l-2 11c-1 7-4 10-9 10" fill="none" stroke="#fff" strokeWidth="2" opacity=".8"/><path d="M177 165h-11" stroke="#8d9991" strokeWidth="3" strokeLinecap="round"/></g></svg></span>
  if (kind === 'phone') return <span className="studio-miniature studio-miniature--phone" aria-hidden="true"><i className="frame" /><i className="glass" /><i className="island" /><i className="side" /></span>
  return <span className="studio-miniature studio-miniature--generic" aria-hidden="true"><i /></span>
}

function deviceKind(name: string) {
  const value = name.toLocaleLowerCase('vi')
  if (value.includes('macbook') || value.includes('mac book')) return 'laptop'
  if (value.includes('watch')) return 'watch'
  if (value.includes('airpod')) return 'earbuds'
  if (value.includes('pad')) return 'tablet'
  if (value.includes('iphone') || value.includes('phone')) return 'phone'
  return 'generic'
}

function deviceDescription(kind: string) {
  return ({ phone: 'Điện thoại', tablet: 'Máy tính bảng', laptop: 'Máy tính xách tay', watch: 'Đồng hồ thông minh', earbuds: 'Tai nghe không dây', generic: 'Thiết bị được hỗ trợ' } as Record<string, string>)[kind]
}
