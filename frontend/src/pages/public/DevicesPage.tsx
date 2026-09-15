import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { publicApi } from '../../api/publicApi'
import type { PublicCatalogResponse } from '../../api/contracts'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { formatMoney } from '../../utils/format'

export function DevicesPage() {
  const [params] = useSearchParams()
  const [typeId, setTypeId] = useState<number | undefined>(() => Number(params.get('type')) || undefined)
  const [modelId, setModelId] = useState<number>()
  const [issueId, setIssueId] = useState<number>()
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const models = useQuery({ queryKey: ['public', 'device-models', typeId], queryFn: ({ signal }) => publicApi.deviceModels(typeId, signal), enabled: Boolean(typeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(signal) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: Boolean(modelId && issueId) })

  const chooseService = (service: PublicCatalogResponse) => `/booking?type=${typeId}&model=${service.deviceModelId}&issue=${service.serviceIssueId}&service=${service.id}`
  return <div className="page-shell section-pad">
    <header className="page-intro"><span className="eyebrow">Khám phá dịch vụ</span><h1>Đi từ thiết bị đến đúng nhu cầu.</h1><p>Chọn lần lượt loại thiết bị, model và nhóm vấn đề. Chi tiết triệu chứng có thể bổ sung khi đặt lịch.</p></header>
    <div className="discovery-layout">
      <aside className="discovery-progress" aria-label="Tiến trình chọn dịch vụ"><span className={typeId ? 'done' : 'active'}>1</span><p>Loại thiết bị</p><span className={modelId ? 'done' : typeId ? 'active' : ''}>2</span><p>Model</p><span className={issueId ? 'done' : modelId ? 'active' : ''}>3</span><p>Vấn đề</p><span className={catalog.data?.length ? 'active' : ''}>4</span><p>Dịch vụ</p></aside>
      <div className="discovery-content">
        <SelectionBlock number="01" title="Bạn đang dùng thiết bị nào?" loading={types.isLoading} error={types.error} retry={() => types.refetch()}>
          {types.data?.map(item => <button className={`choice-card ${typeId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setTypeId(item.id); setModelId(undefined); setIssueId(undefined) }}><span>Thiết bị</span><strong>{item.name}</strong></button>)}
        </SelectionBlock>
        {typeId && <SelectionBlock number="02" title="Chọn đúng model" loading={models.isLoading} error={models.error} retry={() => models.refetch()}>
          {models.data?.map(item => <button className={`choice-card ${modelId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setModelId(item.id); setIssueId(undefined) }}><span>Model</span><strong>{item.name}</strong></button>)}
        </SelectionBlock>}
        {modelId && <SelectionBlock number="03" title="Nhóm vấn đề cần xử lý" loading={issues.isLoading} error={issues.error} retry={() => issues.refetch()}>
          {issues.data?.map(item => <button className={`choice-card choice-card--compact ${issueId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setIssueId(item.id)}><strong>{item.name}</strong></button>)}
        </SelectionBlock>}
        {modelId && issueId && <section className="selection-block"><div className="selection-title"><span>04</span><div><h2>Dịch vụ phù hợp</h2><p>API public hiện chưa trả mã loại dịch vụ và thông tin hãng/phiên bản linh kiện. Danh sách dưới đây giữ nguyên dữ liệu thật; bộ lọc loại dịch vụ và selector thay thế sẽ được bật khi backend bổ sung contract.</p></div></div>
          {catalog.isLoading ? <LoadingState /> : catalog.isError ? <ErrorState error={catalog.error} retry={() => catalog.refetch()} /> : !catalog.data?.length ? <EmptyState title="Chưa có dịch vụ phù hợp">Bạn có thể chọn nhóm vấn đề khác.</EmptyState> : <div className="service-list">{catalog.data.map(service => <article key={service.id}><div><span className="service-id">DV-{String(service.id).padStart(3, '0')}</span><h3>{service.name}</h3><p>{service.standardDurationMinutes ? `${service.standardDurationMinutes} phút dự kiến` : 'Thời lượng xác nhận sau'} · {service.warrantyDays ? `Bảo hành ${service.warrantyDays} ngày` : 'Không có thời hạn bảo hành công khai'}</p></div><div><strong>{formatMoney(service.configuredPrice)}</strong><Link className="button button--primary" to={chooseService(service)}>Đặt lịch</Link></div></article>)}</div>}
        </section>}
      </div>
    </div>
  </div>
}

function SelectionBlock({ number, title, loading, error, retry, children }: { number: string; title: string; loading: boolean; error: unknown; retry: () => void; children: React.ReactNode }) {
  return <section className="selection-block"><div className="selection-title"><span>{number}</span><h2>{title}</h2></div>{loading ? <LoadingState /> : error ? <ErrorState error={error} retry={retry} /> : <div className="choice-grid">{children}</div>}</section>
}
