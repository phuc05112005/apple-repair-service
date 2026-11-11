import { ConfirmationFields } from './ConfirmationFields'
import type { ConfirmationMethod, ServiceTicketStatus } from '../api/contracts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../api/publicApi'
import type { InspectionRepairItemRequest, RepairItemResponse, ServiceTypeCode } from '../api/contracts'
import { ErrorState, LoadingState } from './AsyncState'
import { formatMoney } from '../utils/format'

interface Props {
  status: ServiceTicketStatus
  modelId: number
  discountPercent: number
  existingItems: RepairItemResponse[]
  items: InspectionRepairItemRequest[]
  onItemsChange: (items: InspectionRepairItemRequest[]) => void
  result: string
  onResultChange: (value: string) => void
  confirmationMethod: ConfirmationMethod | ''
  confirmationNote: string
  authorizedScope?: string | null
  onMethodChange: (value: ConfirmationMethod | '') => void
  onNoteChange: (value: string) => void
  busy: boolean
  onConfirm: () => void
  onPause: () => void
  onCancel?: () => void
}

export function InspectionPlanEditor(props: Props) {
  const [issueId, setIssueId] = useState<number>()
  const [serviceType, setServiceType] = useState<ServiceTypeCode | 'ALL'>('ALL')
  const [catalogId, setCatalogId] = useState<number>()

  const catalog = useQuery({ 
    queryKey: ['public', 'catalog', props.modelId], 
    queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: props.modelId }, signal) 
  })
  const issues = useQuery({ 
    queryKey: ['public', 'service-issues'], 
    queryFn: ({ signal }) => publicApi.serviceIssues(undefined, signal) 
  })

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

  const isSubmitDisabled = props.busy || !props.items.length
  const isWaitingApproval = props.status === 'WAITING_APPROVAL'

  return (
    <section className="ops-section inspection-plan">
      <div className="ops-section__title">
        <h2>{isWaitingApproval ? 'Ghi nhận phản hồi & Cập nhật phương án' : 'Phương án kỹ thuật & Dịch vụ'}</h2>
      </div>
      
      <label className="field">
        <span>Kết quả chẩn đoán thực tế</span>
        <textarea 
          placeholder="Nhập ghi chú chẩn đoán thực tế..." 
          maxLength={5000} 
          value={props.result} 
          onChange={event => props.onResultChange(event.target.value)} 
        />
      </label>

      <div className="inspection-plan__picker">
        <h3>Thêm dịch vụ kỹ thuật</h3>
        
        {catalog.isLoading || issues.isLoading ? (
          <LoadingState label="Đang tải dịch vụ…" />
        ) : catalog.isError || issues.isError ? (
          <ErrorState error={catalog.error ?? issues.error} retry={() => { void catalog.refetch(); void issues.refetch() }} />
        ) : (
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
                <span>Phương án</span>
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

            {selected && (
              <div className="inspection-plan__quote">
                <strong>{selected.name}</strong>
                <span>{formatMoney(selected.displayPrice)}</span>
              </div>
            )}

            <button type="button" className="button button--secondary" disabled={!selected || props.busy} onClick={add}>
              + Thêm dịch vụ
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
              <button type="button" className="text-action text-action--danger" disabled={props.busy || original?.warrantyDecision === 'APPROVED'} onClick={() => props.onItemsChange(props.items.filter((_, i) => i !== index))}>
                Xóa
              </button>
            </article>
          )
        })}
      </div>

      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Hình thức xác nhận ý kiến khách hàng</h3>
        <ConfirmationFields 
          method={props.confirmationMethod || 'DIRECT'} 
          note={props.confirmationNote} 
          scope={props.authorizedScope} 
          onMethod={props.onMethodChange} 
          onNote={props.onNoteChange} 
        />
      </div>

      <div className="button-row" style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {isWaitingApproval ? (
          <>
            <button 
              type="button" 
              className="button button--primary" 
              disabled={isSubmitDisabled} 
              onClick={props.onConfirm}
            >
              {props.busy ? 'Đang lưu…' : 'Khách đã xác nhận & Tiếp tục'}
            </button>
            {props.onCancel && (
              <button type="button" className="button button--quiet" onClick={props.onCancel}>
                Thu gọn form
              </button>
            )}
          </>
        ) : (
          <>
            <button 
              type="button" 
              className="button button--primary" 
              disabled={isSubmitDisabled} 
              onClick={props.onConfirm}
            >
              {props.busy ? 'Đang lưu…' : 'Khách đã xác nhận & Tiếp tục'}
            </button>
            <button 
              type="button" 
              className="button button--secondary" 
              disabled={isSubmitDisabled} 
              onClick={props.onPause}
            >
              {props.busy ? 'Đang lưu…' : 'Chờ khách xác nhận'}
            </button>
            {props.onCancel && (
              <button type="button" className="button button--quiet" onClick={props.onCancel}>
                Hủy
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}