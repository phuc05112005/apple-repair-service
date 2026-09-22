import { ConfirmationFields } from './ConfirmationFields'
import type { ConfirmationMethod } from '../api/contracts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../api/publicApi'
import type { InspectionRepairItemRequest, RepairItemResponse, ServiceTypeCode } from '../api/contracts'
import { ErrorState, LoadingState } from './AsyncState'
import { formatMoney } from '../utils/format'

interface Props {
  modelId: number
  discountPercent: number
  existingItems: RepairItemResponse[]
  items: InspectionRepairItemRequest[]
  onItemsChange: (items: InspectionRepairItemRequest[]) => void
  result: string
  onResultChange: (value: string) => void
  requiresApproval: boolean
  onApprovalChange: (value: boolean) => void
  confirmationMethod: ConfirmationMethod | ''
  confirmationNote: string
  authorizedScope?: string | null
  onMethodChange: (value: ConfirmationMethod | '') => void
  onNoteChange: (value: string) => void
  busy: boolean
  onSubmit: () => void
}

export function InspectionPlanEditor(props: Props) {
  const [issueId, setIssueId] = useState<number>()
  const [serviceType, setServiceType] = useState<ServiceTypeCode>('REPAIR')
  const [catalogId, setCatalogId] = useState<number>()
  const catalog = useQuery({ queryKey: ['public', 'catalog', props.modelId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: props.modelId }, signal) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(undefined, signal) })
  const available = (catalog.data ?? []).filter(item => item.serviceTypeCode !== 'WARRANTY')
  const choices = available.filter(item => item.serviceIssueId === issueId && item.serviceTypeCode === serviceType
    && !props.items.some(selected => selected.serviceCatalogItemId === item.id))
  const selected = choices.find(item => item.id === catalogId)
  const removedAgreedWork = props.existingItems.some(old => old.approvalStatus === 'APPROVED'
    && !props.items.some(item => old.serviceCatalogItemId === item.serviceCatalogItemId && old.warrantySourceItemId === item.warrantySourceItemId))
  const changedScope = removedAgreedWork || props.items.some(item => !props.existingItems.some(old => old.approvalStatus === 'APPROVED'
    && old.serviceCatalogItemId === item.serviceCatalogItemId && old.warrantySourceItemId === item.warrantySourceItemId
    && old.finalPrice !== null && item.finalPrice !== null && item.finalPrice <= old.finalPrice))
  const missingPrice = props.items.some(item => item.warrantySourceItemId === null && item.finalPrice === null)

  function add() {
    if (!selected) return
    const basePrice = selected.displayPrice
    props.onItemsChange([...props.items, { serviceCatalogItemId: selected.id, basePrice,
      finalPrice: basePrice === null ? null : Math.round(basePrice * (100 - props.discountPercent)) / 100,
      warrantySourceItemId: null }])
    setCatalogId(undefined)
  }

  return <section className="ops-section inspection-plan">
    <div className="ops-section__title"><span>02</span><h2>Kết quả kiểm tra & phương án sửa chữa</h2></div>
    <label className="field"><span>Kết quả kiểm tra thực tế</span><textarea placeholder="Nhập kết quả kiểm tra và hướng xử lý" maxLength={5000} value={props.result} onChange={event => props.onResultChange(event.target.value)} /></label>
    <div className="inspection-plan__picker">
      <h3>Thêm dịch vụ cho thiết bị này</h3>
      <p>Chọn phương án sau kiểm tra. Ghi nhận sự đồng ý trực tiếp, qua điện thoại hoặc trong phạm vi cho phép trước để tiếp tục xử lý.</p>
      {catalog.isLoading || issues.isLoading ? <LoadingState label="Đang tải dịch vụ phù hợp…" /> : catalog.isError || issues.isError ? <ErrorState error={catalog.error ?? issues.error} retry={() => { void catalog.refetch(); void issues.refetch() }} /> : <>
        <div className="form-grid">
          <label className="field"><span>Vấn đề xác định sau kiểm tra</span><select value={issueId ?? ''} onChange={event => { setIssueId(Number(event.target.value) || undefined); setCatalogId(undefined) }}><option value="">Chọn vấn đề</option>{issues.data?.filter(issue => available.some(item => item.serviceIssueId === issue.id)).map(issue => <option key={issue.id} value={issue.id}>{issue.name}</option>)}</select></label>
          <label className="field"><span>Phương án thực hiện</span><select value={serviceType} onChange={event => { setServiceType(event.target.value as ServiceTypeCode); setCatalogId(undefined) }}><option value="REPAIR">Sửa chữa</option><option value="REPLACEMENT">Thay thế linh kiện</option></select></label>
        </div>
        <label className="field"><span>Dịch vụ phù hợp với dòng máy</span><select disabled={!issueId || !choices.length} value={catalogId ?? ''} onChange={event => setCatalogId(Number(event.target.value) || undefined)}><option value="">Chọn dịch vụ</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}{item.partId ? ` · ${[item.partName, item.partBrand, item.partVariant].filter(Boolean).join(' · ')}` : ''}</option>)}</select></label>
        {issueId && !choices.length && <p role="status">Chưa có dịch vụ mới phù hợp, hoặc các dịch vụ này đã nằm trong phương án.</p>}
        {selected && <div className="inspection-plan__quote"><strong>{selected.name}</strong><span>{formatMoney(selected.displayPrice)}</span>{selected.partId && <small>Linh kiện: {[selected.partName, selected.partBrand, selected.partVariant].filter(Boolean).join(' · ')}. Cần ghi nhận sử dụng linh kiện trước khi hoàn tất.</small>}</div>}
        <button type="button" className="button button--secondary" disabled={!selected || props.busy} onClick={add}>Thêm vào phương án</button>
      </>}
    </div>
    {!props.items.length && <div className="phase-notice"><strong>Phiếu chưa có phương án sửa chữa</strong><p>Thêm dịch vụ phù hợp sau khi kiểm tra. Không cần chọn dịch vụ giả khi tiếp nhận.</p></div>}
    <div className="inspection-items">{props.items.map((item, index) => {
      const service = catalog.data?.find(entry => entry.id === item.serviceCatalogItemId)
      const original = props.existingItems.find(entry => entry.approvalStatus !== 'REJECTED' && entry.serviceCatalogItemId === item.serviceCatalogItemId)
      const update = (key: 'basePrice' | 'finalPrice', value: string) => props.onItemsChange(props.items.map((entry, i) => i === index ? { ...entry, [key]: value === '' ? null : Number(value) } : entry))
      return <article key={item.serviceCatalogItemId}>
        <div><span>Hạng mục {index + 1}</span><strong>{service?.name ?? original?.itemNameSnapshot ?? `Dịch vụ #${item.serviceCatalogItemId}`}</strong>{service?.partId && <small>{[service.partName, service.partBrand, service.partVariant].filter(Boolean).join(' · ')}</small>}</div>
        <label className="field"><span>Giá ban đầu</span><input placeholder="Nhập giá trước điều chỉnh" disabled={original?.warrantyDecision === 'APPROVED'} type="number" min="0" step="0.01" value={item.basePrice ?? ''} onChange={event => update('basePrice', event.target.value)} /></label>
        <label className="field"><span>Giá sau kiểm tra</span><input placeholder="Nhập giá khách cần thanh toán" disabled={original?.warrantyDecision === 'APPROVED'} type="number" min="0" step="0.01" value={item.finalPrice ?? ''} onChange={event => update('finalPrice', event.target.value)} /></label>
        <button type="button" className="text-action text-action--danger" disabled={props.busy || original?.warrantyDecision === 'APPROVED'} onClick={() => props.onItemsChange(props.items.filter((_, i) => i !== index))}>Bỏ khỏi phương án</button>
      </article>
    })}</div>
    <label className="check-field"><input type="checkbox" checked={props.requiresApproval} onChange={event => props.onApprovalChange(event.target.checked)} /><span>Chưa liên hệ được khách — tạm dừng và chờ xác nhận</span></label>
    {!props.requiresApproval && <ConfirmationFields method={props.confirmationMethod} note={props.confirmationNote} scope={props.authorizedScope} onMethod={props.onMethodChange} onNote={props.onNoteChange} />}
    {changedScope && !props.requiresApproval && !props.confirmationMethod && <p className="field-error">Ghi nhận cách khách đã đồng ý với phương án mới để tiếp tục.</p>}
    {missingPrice && <p className="field-error" role="status">Vui lòng xác định giá các dịch vụ. Nhập 0 chỉ khi dịch vụ được miễn phí.</p>}
    <button type="button" className="button button--primary" disabled={(changedScope && !props.requiresApproval && !props.confirmationMethod) || !props.result.trim() || !props.items.length || missingPrice || props.items.some(item => (item.finalPrice !== null && (!Number.isFinite(item.finalPrice) || item.finalPrice < 0)) || (item.basePrice !== null && (!Number.isFinite(item.basePrice) || item.basePrice < 0))) || props.busy} onClick={props.onSubmit}>{props.busy ? 'Đang lưu…' : props.requiresApproval ? 'Lưu & chờ liên hệ khách' : 'Lưu phương án & tiếp tục'}</button>
  </section>
}
