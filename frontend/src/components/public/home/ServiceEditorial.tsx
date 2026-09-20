import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { PublicCatalogResponse, PublicNamedResponse, ServiceTypeCode } from '../../../api/contracts'

const serviceLabels: Record<ServiceTypeCode, string> = { REPAIR: 'Sửa chữa', REPLACEMENT: 'Thay thế linh kiện', WARRANTY: 'Bảo hành' }

export function ServiceEditorial({ issues, catalog }: { issues: UseQueryResult<PublicNamedResponse[], Error>; catalog: UseQueryResult<PublicCatalogResponse[], Error> }) {
  const availableTypes = Array.from(new Set((catalog.data ?? []).filter(item => item.serviceTypeCode !== 'WARRANTY').map(item => item.serviceTypeCode)))
  return <section className="studio-services section-pad studio-reveal">
    <div className="studio-services__intro"><span className="studio-kicker">Bắt đầu từ vấn đề thực tế</span><h2>Thiết bị đang<br /><em>“nói”</em> điều gì?</h2><p>Chọn vấn đề bạn đang gặp. Hệ thống chỉ đưa ra phương án đã được cấu hình cho đúng model.</p><Link to="/devices">Tìm dịch vụ phù hợp <span aria-hidden="true">↗</span></Link></div>
    <div className="studio-services__issues" aria-label="Vấn đề dịch vụ">{issues.isLoading ? <div className="studio-loading">Đang tải vấn đề…</div> : issues.isError ? <div className="studio-error">Không thể tải vấn đề dịch vụ.</div> : issues.data?.map((issue, index) => <Link to="/devices" key={issue.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{issue.name}</strong><i aria-hidden="true">→</i></Link>)}</div>
    <div className="studio-services__catalog"><span>Loại dịch vụ đang có</span><div>{catalog.isLoading ? <small>Đang tải…</small> : availableTypes.length ? availableTypes.map(type => <Link to="/booking" key={type}><i aria-hidden="true" />{serviceLabels[type]}<small>{type}</small></Link>) : <small>Danh mục đang được cập nhật.</small>}</div></div>
  </section>
}
