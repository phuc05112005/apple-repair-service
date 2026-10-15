import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WarrantyHistoryItemResponse } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { DetailDrawer } from '../../../components/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { formatDate, formatDateTime } from '../../../utils/format'

export function WarrantyHistoryPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'phone' | 'ticketCode'>('phone')
  const [term, setTerm] = useState('')
  const [lookup, setLookup] = useState<{ phone?: string; ticketCode?: string }>()
  const [source, setSource] = useState<WarrantyHistoryItemResponse>()
  const [branchId, setBranchId] = useState<number>()
  const [serviceCatalogItemId, setServiceCatalogItemId] = useState<number>()
  const [issue, setIssue] = useState('')
  const [note, setNote] = useState('')
  const [scope, setScope] = useState('')
  const history = useQuery({ queryKey: ['receptionist', 'warranty-history', lookup], queryFn: ({ signal }) => receptionistApi.warrantyHistory(lookup!, signal), enabled: Boolean(lookup) })
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: Boolean(source) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', source?.deviceModelId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: source!.deviceModelId }, signal), enabled: Boolean(source) })
  const warrantyServices = useMemo(() => (catalog.data ?? []).filter(item => source
    && item.serviceTypeCode === (source.warrantyTechnicalMethod === 'REPLACEMENT' ? 'REPLACEMENT' : 'REPAIR')), [catalog.data, source])
  const grouped = useMemo(() => {
    const map = new Map<number, WarrantyHistoryItemResponse[]>()
    for (const item of history.data?.items ?? []) map.set(item.customerDeviceId, [...(map.get(item.customerDeviceId) ?? []), item])
    return [...map.values()]
  }, [history.data])
  const create = useMutation({
    mutationFn: () => receptionistApi.createWarrantyClaim(source!.repairItemId, { branchId: branchId!, serviceCatalogItemId: serviceCatalogItemId!, customerReportedIssue: issue.trim(), note: note.trim() || undefined, authorizedScope: scope.trim() || undefined }),
    onSuccess: detail => { closeClaim(); navigate(`/internal/receptionist/tickets/${detail.ticket.id}`) },
  })

  function closeClaim() { setSource(undefined); setBranchId(undefined); setServiceCatalogItemId(undefined); setIssue(''); setNote(''); setScope(''); create.reset() }
  function submitLookup(event: FormEvent) { event.preventDefault(); const value = term.trim(); if (value) setLookup(mode === 'phone' ? { phone: value } : { ticketCode: value }) }

  return <div className="workspace-page warranty-history-page">
    <header><span className="eyebrow">Tiếp nhận · Hậu mãi</span><h1>Tra cứu lịch sử & bảo hành</h1><p>Tìm toàn bộ lịch sử theo khách hàng, thiết bị và từng hạng mục; tạo lần tiếp nhận bảo hành trực tiếp từ dữ liệu nguồn còn hiệu lực.</p></header>
    <form className="history-search" onSubmit={submitLookup}>
      <div className="segmented" aria-label="Cách tra cứu"><button type="button" className={mode === 'phone' ? 'active' : ''} onClick={() => { setMode('phone'); setLookup(undefined) }}>Số điện thoại</button><button type="button" className={mode === 'ticketCode' ? 'active' : ''} onClick={() => { setMode('ticketCode'); setLookup(undefined) }}>Mã phiếu dịch vụ</button></div>
      <label className="field"><span>{mode === 'phone' ? 'Số điện thoại khách hàng' : 'Mã phiếu dịch vụ'}</span><input required placeholder={mode === 'phone' ? 'Nhập số điện thoại' : 'Nhập mã phiếu dịch vụ'} value={term} onChange={event => setTerm(event.target.value)} /></label>
      <button className="button button--primary" disabled={!term.trim() || history.isFetching}>{history.isFetching ? 'Đang tra cứu…' : 'Tra cứu'}</button>
    </form>
    {history.isLoading && <LoadingState label="Đang tải lịch sử dịch vụ…" />}
    {history.isError && <ErrorState error={history.error} retry={() => history.refetch()} title="Không thể tra cứu lịch sử" />}
    {history.data && <section className="customer-history">
      <div className="customer-history__identity"><span>{history.data.customerFullName.slice(0, 1).toLocaleUpperCase('vi')}</span><div><small>Khách hàng</small><h2>{history.data.customerFullName}</h2><p>{history.data.customerPhone}</p></div></div>
      {!grouped.length ? <EmptyState title="Khách hàng chưa có hạng mục dịch vụ" /> : grouped.map(deviceItems => <article className="device-history" key={deviceItems[0].customerDeviceId}>
        <header><div><small>{deviceItems[0].deviceTypeName}</small><h3>{deviceItems[0].deviceModelName}</h3></div><span>{deviceItems.length} hạng mục</span></header>
        <div className="warranty-service-list">{deviceItems.map(item => <section className="warranty-service-card" key={item.repairItemId}>
          <div className="warranty-service-card__main"><span className="record-code">{item.ticketCode}</span><h4>{item.serviceName}</h4><p>Phương án gốc: {item.originalServiceType === 'REPLACEMENT' ? 'Thay thế' : 'Sửa chữa'} · Hoàn tất {formatDateTime(item.completedAt)}</p><small>Bàn giao {formatDateTime(item.handedOverAt)}</small></div>
          <div className="warranty-service-card__coverage"><StatusBadge label={item.eligible ? 'Còn hạn' : item.warrantyEndDate ? 'Hết hạn' : 'Không bảo hành'} tone={item.eligible ? 'success' : 'warning'} /><strong>{item.warrantyStartDate ? `${formatDate(item.warrantyStartDate)} → ${formatDate(item.warrantyEndDate)}` : 'Không có kỳ bảo hành'}</strong><span>{item.warrantyTechnicalMethod ? `Xử lý bảo hành: ${item.warrantyTechnicalMethod === 'REPLACEMENT' ? 'Thay thế' : 'Sửa chữa'}` : 'Chưa cấu hình phương án bảo hành'}</span></div>
          <div className="warranty-service-card__claims"><strong>{item.claimCount} lần bảo hành</strong><span>{item.lastClaimAt ? `Gần nhất ${formatDateTime(item.lastClaimAt)}` : 'Chưa phát sinh'}</span>{item.claims.length > 0 && <details><summary>Xem lịch sử bảo hành</summary><ol>{item.claims.map(claim => <li key={claim.repairItemId}><span>{claim.ticketCode}</span><small>{formatDateTime(claim.receivedAt)} · {claim.technicalMethod === 'REPLACEMENT' ? 'Thay thế' : 'Sửa chữa'}</small></li>)}</ol></details>}</div>
          <div className="warranty-service-card__action"><button className="button button--secondary" disabled={!item.eligible || !item.warrantyTechnicalMethod} onClick={() => setSource(item)}>Tạo phiếu bảo hành</button></div>
        </section>)}</div>
      </article>)}
    </section>}
    {source && <DetailDrawer busy={create.isPending} eyebrow="Tiếp nhận bảo hành" title={source.serviceName} onClose={closeClaim} footer={<><button className="button button--quiet" disabled={create.isPending} onClick={closeClaim}>Hủy</button><button className="button button--primary" disabled={!branchId || !serviceCatalogItemId || !issue.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Đang tạo phiếu…' : 'Tạo phiếu bảo hành'}</button></>}>
      <div className="warranty-source-summary"><span>Đặc trưng bảo hành từ hạng mục nguồn</span><strong>{source.deviceModelName}</strong><p>{source.ticketCode} · {source.warrantyTechnicalMethod === 'REPLACEMENT' ? 'Thay thế linh kiện' : 'Sửa chữa'} · nhân viên chọn dịch vụ thực tế khi tiếp nhận</p></div>
      <div className="drawer-form"><label className="field"><span>Chi nhánh tiếp nhận</span><select required value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Chọn chi nhánh</option>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>Dịch vụ áp dụng cho lần bảo hành</span><select required value={serviceCatalogItemId ?? ''} onChange={event => setServiceCatalogItemId(Number(event.target.value) || undefined)}><option value="">Chọn dịch vụ phù hợp</option>{warrantyServices.map(service => <option key={service.id} value={service.id}>{service.name}{service.partBrand || service.partVariant ? ` · ${[service.partBrand, service.partVariant].filter(Boolean).join(' · ')}` : ''}</option>)}</select><small>Danh sách gồm toàn bộ dịch vụ đúng model và đặc trưng {source.warrantyTechnicalMethod === 'REPLACEMENT' ? 'thay thế' : 'sửa chữa'}, kể cả dịch vụ ban đầu.</small></label>{catalog.isLoading && <LoadingState label="Đang tải dịch vụ phù hợp…" />}{catalog.isError && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}{!catalog.isLoading && !catalog.isError && warrantyServices.length === 0 && <EmptyState title="Chưa có dịch vụ phù hợp để tiếp nhận bảo hành" />}<label className="field"><span>Lỗi phát sinh cần bảo hành</span><textarea required placeholder="Nhập biểu hiện lỗi khách đang gặp" value={issue} onChange={event => setIssue(event.target.value)} /></label><label className="field"><span className="field-label">Ghi chú tiếp nhận <i>Không bắt buộc</i></span><textarea placeholder="Nhập ghi chú cho kỹ thuật viên" value={note} onChange={event => setNote(event.target.value)} /></label><label className="field"><span className="field-label">Phạm vi khách cho phép trước <i>Không bắt buộc</i></span><textarea placeholder="Nhập phạm vi hoặc điều kiện khách đã đồng ý" value={scope} onChange={event => setScope(event.target.value)} /></label>{create.isError && <ErrorState error={create.error} />}</div>
    </DetailDrawer>}
  </div>
}



