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
  const [serviceType, setServiceType] = useState<ServiceTypeCode | 'ALL'>('ALL')
  const [catalogId, setCatalogId] = useState<number>()

  const catalog = useQuery({ queryKey: ['public', 'catalog', props.modelId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: props.modelId }, signal) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(undefined, signal) })

  const available = (catalog.data ?? []).filter(item => item.serviceTypeCode !== 'WARRANTY')
  
  const choices = available.filter(item => 
    item.serviceIssueId === issueId &&
    (serviceType === 'ALL' || item.serviceTypeCode === serviceType) &&
    !props.items.some(selected => selected.serviceCatalogItemId === item.id)
  )

  const selected = choices.find(item => item.id === catalogId)

  function add() {
    if (!selected) return
    const basePrice = selected.displayPrice
    props.onItemsChange([...props.items, {
      serviceCatalogItemId: selected.id,
      basePrice,
      finalPrice: basePrice === null ? null : Math.round(basePrice * (100 - props.discountPercent)) / 100,
      warrantySourceItemId: null
    }])
    setCatalogId(undefined)
  }

  function handleSubmit() {
    // Nếu chưa gõ kết quả kiểm tra, tự động điền chuỗi mặc định
    if (!props.result.trim()) {
      props.onResultChange('Đã kiểm tra thiết bị và thống nhất phương án xử lý.')
    }
    // Nếu chưa chọn hình thức xác nhận, tự động gán 'DIRECT' (Trao đổi trực tiếp)
    if (!props.requiresApproval && !props.confirmationMethod) {
      props.onMethodChange('DIRECT')
    }
    props.onSubmit()
  }

  // Điều kiện disabled duy nhất: Đang gửi API hoặc chưa chọn dịch vụ nào
  const isSubmitDisabled = props.busy || !props.items.length

  return (
    <section className="ops-section inspection-plan">
      <div className="ops-section__title"><h2>Kết quả kiểm tra & phương án sửa chữa</h2></div>
      
      <label className="field">
        <span>Kết quả kiểm tra thực tế</span>
        <textarea 
          placeholder="Nhập kết quả kiểm tra thực tế (Tùy chọn, hệ thống sẽ tự ghi nhận nếu để trống)" 
          maxLength={5000} 
          value={props.result} 
          onChange={event => props.onResultChange(event.target.value)} 
        />
      </label>

      <div className="inspection-plan__picker">
        <h3>Thêm dịch vụ cho thiết bị này</h3>
        <p>Chọn dịch vụ kỹ thuật phù hợp từ danh mục để đưa vào phương án.</p>
        
        {catalog.isLoading || issues.isLoading ? <LoadingState label="Đang tải dịch vụ phù hợp…" /> : catalog.isError || issues.isError ? <ErrorState error={catalog.error ?? issues.error} retry={() => { void catalog.refetch(); void issues.refetch() }} /> : (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Vấn đề xác định</span>
                <select value={issueId ?? ''} onChange={event => { setIssueId(Number(event.target.value) || undefined); setCatalogId(undefined) }}>
                  <option value="">Chọn vấn đề</option>
                  {issues.data?.filter(issue => available.some(item => item.serviceIssueId === issue.id)).map(issue => (
                    <option key={issue.id} value={issue.id}>{issue.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Phương án thực hiện</span>
                <select value={serviceType} onChange={event => { setServiceType(event.target.value as ServiceTypeCode | 'ALL'); setCatalogId(undefined) }}>
                  <option value="ALL">Tất cả phương án (Sửa / Thay thế)</option>
                  <option value="REPAIR">Sửa chữa</option>
                  <option value="REPLACEMENT">Thay thế linh kiện</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Dịch vụ kỹ thuật</span>
              <select disabled={!issueId || !choices.length} value={catalogId ?? ''} onChange={event => setCatalogId(Number(event.target.value) || undefined)}>
                <option value="">Chọn dịch vụ</option>
                {choices.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.partId ? ` · ${[item.partName, item.partBrand, item.partVariant].filter(Boolean).join(' · ')}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {issueId && !choices.length && <p role="status">Không có dịch vụ mới hoặc dịch vụ này đã được thêm vào phương án.</p>}

            {selected && (
              <div className="inspection-plan__quote">
                <strong>{selected.name}</strong>
                <span>{formatMoney(selected.displayPrice)}</span>
              </div>
            )}

            <button type="button" className="button button--secondary" disabled={!selected || props.busy} onClick={add}>
              + Thêm vào phương án
            </button>
          </>
        )}
      </div>

      <div className="inspection-items">
        {props.items.map((item, index) => {
          const service = catalog.data?.find(entry => entry.id === item.serviceCatalogItemId)
          const original = props.existingItems.find(entry => entry.approvalStatus !== 'REJECTED' && entry.serviceCatalogItemId === item.serviceCatalogItemId)
          const update = (key: 'basePrice' | 'finalPrice', value: string) => props.onItemsChange(props.items.map((entry, i) => i === index ? { ...entry, [key]: value === '' ? null : Number(value) } : entry))

          return (
            <article key={item.serviceCatalogItemId}>
              <div>
                <span>Hạng mục {index + 1}</span>
                <strong>{service?.name ?? original?.itemNameSnapshot ?? `Dịch vụ #${item.serviceCatalogItemId}`}</strong>
              </div>
              <label className="field">
                <span>Giá gốc</span>
                <input disabled={original?.warrantyDecision === 'APPROVED'} type="number" min="0" value={item.basePrice ?? ''} onChange={event => update('basePrice', event.target.value)} />
              </label>
              <label className="field">
                <span>Giá áp dụng</span>
                <input disabled={original?.warrantyDecision === 'APPROVED'} type="number" min="0" value={item.finalPrice ?? ''} onChange={event => update('finalPrice', event.target.value)} />
              </label>
              <button type="button" className="text-action text-action--danger" disabled={props.busy || original?.warrantyDecision === 'APPROVED'} onClick={() => props.onItemsChange(props.items.filter((_, i) => i !== index))}>Xóa</button>
            </article>
          )
        })}
      </div>

      <label className="check-field" style={{ margin: '15px 0' }}>
        <input type="checkbox" checked={props.requiresApproval} onChange={event => props.onApprovalChange(event.target.checked)} />
        <span>Chưa liên hệ được khách — tạm dừng chờ xác nhận</span>
      </label>

      {!props.requiresApproval && (
        <ConfirmationFields 
          method={props.confirmationMethod || 'DIRECT'} 
          note={props.confirmationNote} 
          scope={props.authorizedScope} 
          onMethod={props.onMethodChange} 
          onNote={props.onNoteChange} 
        />
      )}

      <button 
        type="button" 
        className="button button--primary" 
        disabled={isSubmitDisabled} 
        onClick={handleSubmit}
        style={{ marginTop: '15px' }}
      >
        {props.busy ? 'Đang lưu…' : props.requiresApproval ? 'Lưu & Chờ liên hệ khách' : 'Lưu phương án & Tiếp tục'}
      </button>
    </section>
  )
}