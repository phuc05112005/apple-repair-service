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
  if (kind === 'earbuds') return <span className="studio-miniature studio-miniature--earbuds" aria-hidden="true"><i className="case" /><i className="lid" /><i className="bud bud--left" /><i className="bud bud--right" /></span>
  return <span className="studio-miniature studio-miniature--phone" aria-hidden="true"><i className="frame" /><i className="glass" /><i className="island" /><i className="side" /></span>
}

function deviceKind(name: string) {
  const value = name.toLocaleLowerCase('vi')
  if (value.includes('mac')) return 'laptop'
  if (value.includes('watch')) return 'watch'
  if (value.includes('airpod')) return 'earbuds'
  if (value.includes('pad')) return 'tablet'
  return 'phone'
}

function deviceDescription(kind: string) {
  return ({ phone: 'Điện thoại', tablet: 'Máy tính bảng', laptop: 'Máy tính xách tay', watch: 'Đồng hồ thông minh', earbuds: 'Tai nghe không dây' } as Record<string, string>)[kind]
}
