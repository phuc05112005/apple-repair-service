import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { publicApi } from '../../api/publicApi'
import type { PublicCatalogResponse, ServiceTypeCode } from '../../api/contracts'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { formatMoney } from '../../utils/format'

const serviceLabels: Record<ServiceTypeCode, string> = { REPAIR: 'Sửa chữa', REPLACEMENT: 'Thay thế linh kiện', INSPECTION: 'Kiểm tra / Tư vấn', WARRANTY: 'Bảo hành' }

export function DevicesPage() {
  const [params] = useSearchParams()
  const [typeId, setTypeId] = useState<number | undefined>(() => Number(params.get('type')) || undefined)
  const [modelId, setModelId] = useState<number>()
  const [issueId, setIssueId] = useState<number>()
  const [modelSearch, setModelSearch] = useState('')
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const models = useQuery({ queryKey: ['public', 'device-models', typeId], queryFn: ({ signal }) => publicApi.deviceModels(typeId, signal), enabled: Boolean(typeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(signal) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: Boolean(modelId && issueId) })
  const visibleModels = (models.data ?? []).filter(model => model.name.toLocaleLowerCase('vi').includes(modelSearch.trim().toLocaleLowerCase('vi')))
  const visibleCatalog = (catalog.data ?? []).filter(service => service.serviceTypeCode !== 'WARRANTY')
  const grouped = useMemo(() => {
    const values = new Map<ServiceTypeCode, PublicCatalogResponse[]>()
    visibleCatalog.forEach(item => values.set(item.serviceTypeCode, [...(values.get(item.serviceTypeCode) ?? []), item]))
    return Array.from(values.entries())
  }, [visibleCatalog])
  const selectedType = types.data?.find(item => item.id === typeId)
  const selectedModel = models.data?.find(item => item.id === modelId)
  const selectedIssue = issues.data?.find(item => item.id === issueId)
  const chooseService = (service: PublicCatalogResponse) => `/booking?type=${typeId}&model=${service.deviceModelId}&issue=${service.serviceIssueId}&service=${service.id}`

  return <div className="page-shell section-pad devices-page">
    <header className="page-intro devices-intro"><span className="eyebrow">Khám phá dịch vụ</span><h1>Đi từ thiết bị<br />đến đúng nhu cầu.</h1><p>Chọn lần lượt loại thiết bị, model và vấn đề. Hệ thống chỉ hiển thị các phương án đang có trong danh mục thực tế.</p></header>
    <div className="selection-summary" aria-live="polite"><span>{selectedType?.name ?? 'Loại thiết bị'}</span><i aria-hidden="true">→</i><span>{selectedModel?.name ?? 'Model'}</span><i aria-hidden="true">→</i><span>{selectedIssue?.name ?? 'Vấn đề'}</span><i aria-hidden="true">→</i><strong>{visibleCatalog.length ? `${visibleCatalog.length} phương án` : 'Dịch vụ'}</strong></div>
    <div className="discovery-layout">
      <aside className="discovery-progress" aria-label="Tiến trình chọn dịch vụ"><span className={typeId ? 'done' : 'active'}>1</span><p>Loại thiết bị</p><span className={modelId ? 'done' : typeId ? 'active' : ''}>2</span><p>Model</p><span className={issueId ? 'done' : modelId ? 'active' : ''}>3</span><p>Vấn đề</p><span className={visibleCatalog.length ? 'active' : ''}>4</span><p>Dịch vụ</p></aside>
      <div className="discovery-content">
        <SelectionBlock number="01" title="Bạn đang dùng thiết bị nào?" loading={types.isLoading} error={types.error} retry={() => types.refetch()}><div className="choice-grid">{types.data?.map(item => <button className={`choice-card ${typeId === item.id ? 'selected' : ''}`} aria-pressed={typeId === item.id} key={item.id} onClick={() => { setTypeId(item.id); setModelId(undefined); setIssueId(undefined); setModelSearch('') }}><span>Thiết bị</span><strong>{item.name}</strong></button>)}</div></SelectionBlock>
        {typeId && <SelectionBlock number="02" title="Chọn đúng model" loading={models.isLoading} error={models.error} retry={() => models.refetch()}><label className="public-search"><span className="visually-hidden">Tìm model</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Tìm model..." value={modelSearch} onChange={event => setModelSearch(event.target.value)} /></label>{visibleModels.length ? <div className="choice-grid">{visibleModels.map(item => <button className={`choice-card ${modelId === item.id ? 'selected' : ''}`} aria-pressed={modelId === item.id} key={item.id} onClick={() => { setModelId(item.id); setIssueId(undefined) }}><span>Model</span><strong>{item.name}</strong></button>)}</div> : <EmptyState title="Không tìm thấy model phù hợp." />}</SelectionBlock>}
        {modelId && <SelectionBlock number="03" title="Thiết bị đang gặp vấn đề gì?" loading={issues.isLoading} error={issues.error} retry={() => issues.refetch()}><div className="choice-grid choice-grid--issues">{issues.data?.map(item => <button className={`choice-card choice-card--compact ${issueId === item.id ? 'selected' : ''}`} aria-pressed={issueId === item.id} key={item.id} onClick={() => setIssueId(item.id)}><span aria-hidden="true">○</span><strong>{item.name}</strong></button>)}</div></SelectionBlock>}
        {modelId && issueId && <section className="selection-block selection-block--results"><div className="selection-title"><span>04</span><div><h2>Dịch vụ phù hợp</h2><p>Các phương án dưới đây đến trực tiếp từ danh mục đang hoạt động.</p></div></div>{catalog.isLoading ? <LoadingState /> : catalog.isError ? <ErrorState error={catalog.error} retry={() => catalog.refetch()} /> : !visibleCatalog.length ? <EmptyState title="Hiện chưa có dịch vụ phù hợp cho thiết bị và vấn đề đã chọn."><button className="text-action" onClick={() => setIssueId(undefined)}>Chọn vấn đề khác</button></EmptyState> : <div className="service-groups">{grouped.map(([code, services]) => <section key={code}><header><div><span>{code}</span><h3>{serviceLabels[code]}</h3></div><small>{services.length} phương án</small></header><div className="service-list">{services.map(service => <article key={service.id}><div><span className="service-id">DV-{String(service.id).padStart(3, '0')}</span><h3>{service.name}</h3>{service.partId && <p className="part-line">{service.partName} · {service.partBrand ?? 'Không hãng'} · {service.partVariant ?? 'Tiêu chuẩn'}</p>}<p>{service.standardDurationMinutes ? `${service.standardDurationMinutes} phút dự kiến` : 'Thời lượng xác nhận sau'} · {service.warrantyDays ? `Bảo hành ${service.warrantyDays} ngày` : 'Không áp dụng bảo hành'}</p></div><div><strong>{formatMoney(service.displayPrice)}</strong><Link className="button button--primary" to={chooseService(service)}>Đặt lịch</Link></div></article>)}</div></section>)}</div>}</section>}
      </div>
    </div>
  </div>
}

function SelectionBlock({ number, title, loading, error, retry, children }: { number: string; title: string; loading: boolean; error: unknown; retry: () => void; children: React.ReactNode }) {
  return <section className="selection-block"><div className="selection-title"><span>{number}</span><h2>{title}</h2></div>{loading ? <LoadingState /> : error ? <ErrorState error={error} retry={retry} /> : children}</section>
}
