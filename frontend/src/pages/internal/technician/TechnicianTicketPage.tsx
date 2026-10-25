import { DefectiveInventoryPanel } from '../../../components/DefectiveInventoryPanel'
import { TicketTimingPanel } from '../../../components/TicketTimingPanel'
import { ConfirmationFields } from '../../../components/ConfirmationFields'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { WarrantyDecisionPanel } from '../../../components/WarrantyDecisionPanel'
import { confirmationLabels } from '../../../types/labels'
import type { ConfirmationMethod, AvailablePartResponse, InspectionRepairItemRequest, RepairItemResponse, ServiceTicketDetailResponse } from '../../../api/contracts'
import { InspectionPlanEditor } from '../../../components/InspectionPlanEditor'
import { technicianApi } from '../../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { ticketStatusLabels } from '../../../types/labels'
import { businessDateTimeInput, formatDateTime, formatMoney } from '../../../utils/format'

export function TechnicianTicketPage() {
  const id = Number(useParams().ticketId)
  const queryClient = useQueryClient()
  
  // Quản lý Tab công việc
  const [activeTab, setActiveTab] = useState<'ACTION' | 'PLAN_PARTS' | 'TRANSFER' | 'TIMELINE'>('ACTION')

  const detail = useQuery({ queryKey: ['internal', 'ticket', id], queryFn: ({ signal }) => technicianApi.ticket(id, signal), enabled: Number.isInteger(id) && id > 0, retry: false })
  const duration = useQuery({ queryKey: ['internal', 'duration', id], queryFn: ({ signal }) => technicianApi.duration(id, signal), enabled: Boolean(detail.data && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)), retry: false })
  const parts = useQuery({ queryKey: ['internal', 'available-parts', id], queryFn: ({ signal }) => technicianApi.availableParts(id, undefined, signal), enabled: detail.data?.ticket.status === 'REPAIRING' })
  const candidates = useQuery({ queryKey: ['internal', 'transfer-candidates', id], queryFn: ({ signal }) => technicianApi.transferCandidates(id, signal), enabled: Boolean(detail.data && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)) })

  const [inspectionResult, setInspectionResult] = useState('')
  const [confirmationMethod, setConfirmationMethod] = useState<ConfirmationMethod | ''>('')
  const [confirmationNote, setConfirmationNote] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [items, setItems] = useState<InspectionRepairItemRequest[]>()
  const [partNote, setPartNote] = useState('')
  const [targetTechnicianId, setTargetTechnicianId] = useState<number>()
  const [transferNote, setTransferNote] = useState('')
  const [transferWorkDone, setTransferWorkDone] = useState('')
  const [transferCondition, setTransferCondition] = useState('')
  const [approvalMethodByItem, setApprovalMethodByItem] = useState<Record<number, ConfirmationMethod | ''>>({})
  const [approvalNoteByItem, setApprovalNoteByItem] = useState<Record<number, string>>({})
  const [waitResolvedAt, setWaitResolvedAt] = useState(() => businessDateTimeInput())
  const [waitResolutionNote, setWaitResolutionNote] = useState('')

  const proposedItems = items ?? (detail.data?.repairItems.filter(item => item.approvalStatus !== 'REJECTED').map(item => ({ serviceCatalogItemId: item.serviceCatalogItemId, basePrice: item.basePrice, finalPrice: item.finalPrice, warrantySourceItemId: item.warrantySourceItemId })) ?? [])
  const proposedResult = inspectionResult || detail.data?.ticket.inspectionResult || ''

  function acceptResult(updated: ServiceTicketDetailResponse) {
    setItems(undefined); setRequiresApproval(false); setConfirmationMethod(''); setConfirmationNote('')
    queryClient.setQueryData(['internal', 'ticket', id], updated)
    void queryClient.invalidateQueries({ queryKey: ['internal', 'duration', id] })
    void queryClient.invalidateQueries({ queryKey: ['internal', 'time-estimates', id] })
    void queryClient.invalidateQueries({ queryKey: ['internal', 'technician', 'work'] })
  }

  const transition = useMutation({
    mutationFn: (kind: 'start' | 'inspect' | 'wait' | 'resume' | 'finish') => {
      if (kind === 'start') return technicianApi.startInspection(id)
      if (kind === 'inspect') return technicianApi.inspect(id, { inspectionResult: proposedResult, requiresCustomerApproval: requiresApproval, items: proposedItems, confirmationMethod: confirmationMethod || undefined, confirmationNote: confirmationNote.trim() || undefined })
      if (kind === 'wait') return technicianApi.waitForPart(id, partNote || undefined)
      if (kind === 'resume') return technicianApi.resume(id)
      return technicianApi.finish(id)
    }, onSuccess: acceptResult,
  })

  const approval = useMutation({
    mutationFn: ({ itemId, decision }: { itemId: number; decision: 'APPROVED' | 'REJECTED' }) => technicianApi.approval(itemId, decision, approvalMethodByItem[itemId] as ConfirmationMethod, approvalNoteByItem[itemId]?.trim() || undefined, waitResolvedAt || undefined),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) },
  })

  const resolveWait = useMutation({
    mutationFn: () => technicianApi.resolveWait(id, waitResolvedAt || undefined, waitResolutionNote.trim() || undefined),
    onSuccess: acceptResult,
  })

  const transfer = useMutation({
    mutationFn: () => technicianApi.requestTransfer(id, targetTechnicianId!, transferNote.trim(), transferWorkDone.trim(), transferCondition.trim()),
    onSuccess: async () => { setTargetTechnicianId(undefined); setTransferNote(''); setTransferWorkDone(''); setTransferCondition(''); await queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) }
  })

  if (!Number.isInteger(id) || id <= 0) return <ErrorState error={new Error('Mã phiếu không hợp lệ')} />
  if (detail.isLoading) return <LoadingState label="Đang tải phiếu dịch vụ…" />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => detail.refetch()} />
  if (!detail.data) return <EmptyState title="Không tìm thấy phiếu hoặc bạn không còn quyền truy cập" />

  const ticket = detail.data.ticket
  const context = detail.data.context
  const currentEvent = detail.data.history.at(-1)
  const waitResolved = Boolean(currentEvent?.toStatus === ticket.status && currentEvent.resolvedAt)
  const pendingApprovalItems = detail.data.repairItems.filter(item => item.approvalStatus === 'PENDING')

  return (
    <div className="workspace-page ticket-workspace">
      <header className="ticket-header">
        <div>
          <span className="record-code">Phiếu #{ticket.id}</span>
          <h1>Xử lý phiếu dịch vụ</h1>
          <p>{context.deviceModelName} · {context.customerFullName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
        </div>
        <StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" />
      </header>

      <div className="tech-focus-bar">
        <div>
          <span>Thời lượng thực hiện</span>
          <strong>{duration.data ? `${duration.data.currentRepairMinutes} phút` : 'Đang tính…'}</strong>
        </div>
        <div>
          <span>Trạng thái hiện tại</span>
          <strong>{nextAction(ticket.status)}</strong>
        </div>
      </div>

      {/* THANH TAB KHÔNG ĐÁNH SỐ BƯỚC */}
      <nav style={{ display: 'flex', gap: '8px', margin: '20px 0 10px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button 
          type="button"
          className={`button ${activeTab === 'ACTION' ? 'button--primary' : 'button--quiet'}`} 
          onClick={() => setActiveTab('ACTION')}
        >
          Thao tác chính
        </button>
        <button 
          type="button"
          className={`button ${activeTab === 'PLAN_PARTS' ? 'button--primary' : 'button--quiet'}`} 
          onClick={() => setActiveTab('PLAN_PARTS')}
        >
          Phương án & Linh kiện
        </button>
        {!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && (
          <button 
            type="button"
            className={`button ${activeTab === 'TRANSFER' ? 'button--primary' : 'button--quiet'}`} 
            onClick={() => setActiveTab('TRANSFER')}
          >
            Chuyển giao ca
          </button>
        )}
        <button 
          type="button"
          className={`button ${activeTab === 'TIMELINE' ? 'button--primary' : 'button--quiet'}`} 
          onClick={() => setActiveTab('TIMELINE')}
        >
          Lịch sử & SLA
        </button>
      </nav>

      {(transition.isError || transfer.isError || approval.isError || resolveWait.isError) && (
        <ErrorState error={transition.error ?? transfer.error ?? approval.error ?? resolveWait.error} />
      )}

      {/* TAB 1: THAO TÁC CHÍNH */}
      {activeTab === 'ACTION' && (
        <>
          <section className="ops-section">
            <div className="ops-section__title"><h2>Khách hàng & thiết bị</h2></div>
            <dl className="record-grid">
              <div><dt>Khách hàng</dt><dd>{context.customerFullName}<br /><small>{context.customerPhone}</small></dd></div>
              <div><dt>Thiết bị</dt><dd>{context.deviceModelName}<br /><small>{context.serialNumber || 'Chưa có số sê-ri'}{context.storage ? ` · ${context.storage}` : ''}</small></dd></div>
              <div><dt>Vấn đề</dt><dd>{context.serviceIssues.join(', ')}</dd></div>
              <div><dt>Dịch vụ yêu cầu</dt><dd>{context.requestedServices.join(', ')}</dd></div>
            </dl>
            {context.symptomDescription && <div className="detail-note"><span>Mô tả sự cố của khách</span><p>{context.symptomDescription}</p></div>}
            <div className="detail-note"><span>Tình trạng khi tiếp nhận</span><p>{ticket.receivedCondition}</p></div>
            {ticket.inspectionResult && <div className="detail-note"><span>Kết quả kiểm tra</span><p>{ticket.inspectionResult}</p></div>}
          </section>

          {ticket.status === 'ASSIGNED' && (
            <section className="next-action-panel">
              <span>{ticketStatusLabels.ASSIGNED}</span>
              <h2>Bắt đầu kiểm tra thiết bị</h2>
              <p>Tiến hành kiểm tra chi tiết để xác định phương án sửa chữa.</p>
              <button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('start')}>Bắt đầu kiểm tra</button>
            </section>
          )}

          {ticket.status === 'WAITING_APPROVAL' && (
            <section className="next-action-panel next-action-panel--waiting">
              <span>{ticketStatusLabels.WAITING_APPROVAL}</span>
              {pendingApprovalItems.length ? (
                <>
                  <h2>Ghi nhận phản hồi từ khách hàng</h2>
                  <label className="field">
                    <span>Thời gian phản hồi</span>
                    <input type="datetime-local" max={businessDateTimeInput()} value={waitResolvedAt} onChange={event => setWaitResolvedAt(event.target.value)} />
                  </label>
                  {pendingApprovalItems.map(item => (
                    <article className="wait-resolution-card" key={item.id}>
                      <h3>{item.itemNameSnapshot}</h3>
                      <ConfirmationFields method={approvalMethodByItem[item.id] ?? ''} note={approvalNoteByItem[item.id] ?? ''} scope={ticket.authorizedScope} onMethod={value => setApprovalMethodByItem(current => ({ ...current, [item.id]: value }))} onNote={value => setApprovalNoteByItem(current => ({ ...current, [item.id]: value }))} />
                      <div className="button-row">
                        <button className="button button--primary" disabled={approval.isPending || !approvalMethodByItem[item.id] || !waitResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'APPROVED' })}>Khách đồng ý</button>
                        <button className="button button--quiet" disabled={approval.isPending || !approvalMethodByItem[item.id] || !waitResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'REJECTED' })}>Khách từ chối</button>
                      </div>
                    </article>
                  ))}
                </>
              ) : (
                <>
                  <h2>Đã có xác nhận – Sẵn sàng xử lý tiếp</h2>
                  <button className="button button--primary" disabled={transition.isPending || !waitResolved} onClick={() => transition.mutate('resume')}>Tiếp tục sửa chữa</button>
                </>
              )}
            </section>
          )}

          {ticket.status === 'REPAIRING' && (
            <section className="next-action-panel">
              <span>{ticketStatusLabels.REPAIRING}</span>
              <h2>Sửa chữa & Xuất linh kiện</h2>
              <div className="repair-admin-list">
                {detail.data.repairItems.filter(item => item.approvalStatus === 'APPROVED').map(item => (
                  <PartUsagePanel key={item.id} item={item} parts={parts.data ?? []} partsLoading={parts.isLoading} ticketId={id} />
                ))}
              </div>
              <label className="field">
                <span>Ghi chú chờ linh kiện (Nếu cần)</span>
                <textarea placeholder="Nhập tên/mã linh kiện cần chờ thêm" value={partNote} onChange={event => setPartNote(event.target.value)} />
              </label>
              <div className="button-row">
                <button className="button button--secondary" disabled={transition.isPending} onClick={() => transition.mutate('wait')}>Chuyển sang Chờ linh kiện</button>
                <button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('finish')}>Hoàn tất sửa chữa</button>
              </div>
            </section>
          )}

          {ticket.status === 'WAITING_PART' && (
            <section className="next-action-panel next-action-panel--waiting">
              <span>{ticketStatusLabels.WAITING_PART}</span>
              {waitResolved ? (
                <>
                  <h2>Linh kiện đã về kho – Tiếp tục xử lý</h2>
                  <button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('resume')}>Tiếp tục sửa chữa</button>
                </>
              ) : (
                <>
                  <h2>Xác nhận linh kiện đã sẵn sàng</h2>
                  <label className="field">
                    <span>Thời gian linh kiện về</span>
                    <input type="datetime-local" max={businessDateTimeInput()} value={waitResolvedAt} onChange={event => setWaitResolvedAt(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Ghi chú</span>
                    <textarea placeholder="Ghi chú thêm về linh kiện" value={waitResolutionNote} onChange={event => setWaitResolutionNote(event.target.value)} />
                  </label>
                  <button className="button button--primary" disabled={resolveWait.isPending || !waitResolvedAt} onClick={() => resolveWait.mutate()}>Ghi nhận đã sẵn sàng</button>
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* TAB 2: PHƯƠNG ÁN & LINH KIỆN */}
      {activeTab === 'PLAN_PARTS' && (
        <>
          {['INSPECTING', 'REPAIRING', 'WAITING_APPROVAL'].includes(ticket.status) && (
            <InspectionPlanEditor
              modelId={context.deviceModelId} 
              discountPercent={ticket.discountPercent}
              existingItems={detail.data.repairItems} 
              items={proposedItems} 
              onItemsChange={setItems}
              result={proposedResult} 
              onResultChange={setInspectionResult}
              requiresApproval={requiresApproval} 
              onApprovalChange={setRequiresApproval}
              confirmationMethod={confirmationMethod} 
              confirmationNote={confirmationNote} 
              authorizedScope={ticket.authorizedScope}
              onMethodChange={setConfirmationMethod} 
              onNoteChange={setConfirmationNote}
              busy={transition.isPending} 
              onSubmit={() => transition.mutate('inspect')}
            />
          )}

          <section className="ops-section">
            <div className="ops-section__title"><h2>Danh mục dịch vụ & Bảo hành</h2></div>
            <div className="repair-admin-list">
              {detail.data.repairItems.map(item => (
                <article key={item.id}>
                  <div>
                    <span>HẠNG MỤC #{item.id}</span>
                    <h3>{item.itemNameSnapshot}</h3>
                    <p>{formatMoney(item.finalPrice)}</p>
                    {item.confirmationMethod && <small>{confirmationLabels[item.confirmationMethod]} · {formatDateTime(item.approvalDecisionAt)}</small>}
                  </div>
                  <StatusBadge label={item.approvalStatus === 'APPROVED' ? 'Đã đồng ý' : item.approvalStatus === 'PENDING' ? 'Chờ liên hệ' : 'Không thực hiện'} tone={item.approvalStatus === 'APPROVED' ? 'success' : 'warning'} />
                  {item.warrantySourceItemId && !item.warrantyDecision && item.approvalStatus !== 'REJECTED' && ['REPAIRING', 'WAITING_APPROVAL'].includes(ticket.status) && (
                    <WarrantyDecisionPanel item={item} modelId={context.deviceModelId} ticketId={id} onSaved={() => setItems(undefined)} />
                  )}
                </article>
              ))}
            </div>
          </section>

          {!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && (
            <DefectiveInventoryPanel ticketId={id} />
          )}
        </>
      )}

      {/* TAB 3: CHUYỂN GIAO CA */}
      {activeTab === 'TRANSFER' && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && (
        <section className="ops-section">
          <div className="ops-section__title"><h2>Yêu cầu chuyển giao công việc</h2></div>
          {candidates.isLoading ? <LoadingState /> : !candidates.data?.length ? <EmptyState title="Không có kỹ thuật viên khác trong ca" /> : (
            <>
              <label className="field">
                <span>Kỹ thuật viên tiếp nhận</span>
                <select value={targetTechnicianId ?? ''} onChange={event => setTargetTechnicianId(Number(event.target.value) || undefined)}>
                  <option value="">Chọn kỹ thuật viên</option>
                  {candidates.data.map(person => (
                    <option key={person.technicianId} value={person.technicianId} disabled={!person.eligible}>
                      {person.technicianName} · Khối lượng: {person.estimatedWorkloadMinutes} phút
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Lý do chuyển giao</span>
                <textarea placeholder="Nhập lý do bàn giao" value={transferNote} onChange={event => setTransferNote(event.target.value)} />
              </label>
              <label className="field">
                <span>Công việc đã hoàn thành</span>
                <textarea placeholder="Mô tả công việc đã làm" value={transferWorkDone} onChange={event => setTransferWorkDone(event.target.value)} />
              </label>
              <label className="field">
                <span>Tình trạng hiện tại của thiết bị</span>
                <textarea placeholder="Mô tả hiện trạng thiết bị" value={transferCondition} onChange={event => setTransferCondition(event.target.value)} />
              </label>
              <button className="button button--secondary" disabled={!targetTechnicianId || !transferNote.trim() || !transferWorkDone.trim() || !transferCondition.trim() || transfer.isPending} onClick={() => transfer.mutate()}>
                Gửi yêu cầu bàn giao
              </button>
            </>
          )}
        </section>
      )}

      {/* TAB 4: LỊCH SỬ & SLA */}
      {activeTab === 'TIMELINE' && (
        <>
          <TicketTimingPanel ticket={ticket} canViewHistory={!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status)} />
          <section className="ops-section">
            <div className="ops-section__title"><h2>Lịch sử mốc xử lý</h2></div>
            <ol className="history-list">
              {detail.data.history.map(event => (
                <li key={event.id}>
                  <span />
                  <div>
                    <strong>{ticketStatusLabels[event.toStatus]}</strong>
                    <p><time dateTime={event.changedAt}>{formatDateTime(event.changedAt)}</time>{event.note ? ` · ${event.note}` : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}

function PartUsagePanel({ item, parts, partsLoading, ticketId }: { item: RepairItemResponse; parts: AvailablePartResponse[]; partsLoading: boolean; ticketId: number }) {
  const client = useQueryClient()
  const [partId, setPartId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const [defectiveNote, setDefectiveNote] = useState('')
  const [collectDefective, setCollectDefective] = useState(false)
  const warrantyReplacement = item.warrantyRemedy === 'REPLACEMENT'
  const usages = useQuery({ queryKey: ['internal', 'part-usages', item.id], queryFn: ({ signal }) => technicianApi.partUsages(item.id, signal) })

  const usePart = useMutation({ 
    mutationFn: () => technicianApi.usePart(item.id, partId!, quantity, warrantyReplacement || collectDefective ? defectiveNote.trim() : undefined), 
    onSuccess: async () => { 
      setPartId(undefined); setQuantity(1); 
      await Promise.all([
        client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), 
        client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] }), 
        client.invalidateQueries({ queryKey: ['internal', 'defective', ticketId] })
      ]) 
    } 
  })

  const reverse = useMutation({ 
    mutationFn: (usageId: number) => technicianApi.reversePartUsage(usageId, 'Hoàn tác xuất linh kiện tốt chưa sử dụng'), 
    onSuccess: async () => { 
      await Promise.all([
        client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), 
        client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] }), 
        client.invalidateQueries({ queryKey: ['internal', 'defective', ticketId] })
      ]) 
    } 
  })

  const selected = parts.find(part => part.partId === partId)

  return (
    <article>
      <div>
        <span>HẠNG MỤC #{item.id}</span>
        <h3>{item.itemNameSnapshot}</h3>
        {usages.data?.map(usage => { 
          const part = parts.find(candidate => candidate.partId === usage.partId); 
          return (
            <p key={usage.id}>
              {part?.name ?? `Linh kiện #${usage.partId}`} × {usage.quantity} · {usage.status === 'ACTIVE' ? 'Đã xuất' : 'Đã hoàn tác'} 
              {usage.status === 'ACTIVE' && !usage.defectiveReturnNote && (
                <button className="text-action" disabled={reverse.isPending} onClick={() => reverse.mutate(usage.id)}>Hoàn kho linh kiện chưa dùng</button>
              )}
            </p> 
          )
        })}
      </div>

      <div className="approval-actions">
        <label className="field">
          <span>Linh kiện tồn kho chi nhánh</span>
          <select disabled={partsLoading} value={partId ?? ''} onChange={event => setPartId(Number(event.target.value) || undefined)}>
            <option value="">{partsLoading ? 'Đang tải…' : 'Chọn linh kiện'}</option>
            {parts.filter(part => !item.expectedPartId || part.partId === item.expectedPartId).map(part => (
              <option key={part.partId} value={part.partId} disabled={part.availableQuantity < 1}>
                {part.name} · Tồn: {part.availableQuantity}
              </option>
            ))}
          </select>
        </label>
        
        <label className="field">
          <span>Số lượng</span>
          <input placeholder="Nhập số lượng" type="number" min="1" max={selected?.availableQuantity ?? 1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
        </label>

        {!warrantyReplacement && item.expectedPartId && (
          <label className="check-field">
            <input type="checkbox" checked={collectDefective} onChange={e => setCollectDefective(e.target.checked)} />
            <span>Có thu hồi linh kiện cũ từ khách</span>
          </label>
        )}

        {(warrantyReplacement || collectDefective) && (
          <label className="field">
            <span>Mô tả linh kiện lỗi thu hồi</span>
            <textarea placeholder="Tên/Mã và mô tả tình trạng linh kiện cũ tháo ra" maxLength={5000} value={defectiveNote} onChange={event => setDefectiveNote(event.target.value)} />
          </label>
        )}

        <button 
          className="button button--primary" 
          disabled={((warrantyReplacement || collectDefective) && !defectiveNote.trim()) || !partId || quantity < 1 || quantity > (selected?.availableQuantity ?? 0) || usePart.isPending} 
          onClick={() => usePart.mutate()}
        >
          Xác nhận xuất linh kiện
        </button>
      </div>

      {(usePart.isError || reverse.isError || usages.isError) && (
        <ErrorState error={usePart.error ?? reverse.error ?? usages.error} />
      )}
    </article>
  )
}

function nextAction(status: ServiceTicketDetailResponse['ticket']['status']) {
  const labels: Partial<Record<ServiceTicketDetailResponse['ticket']['status'], string>> = {
    ASSIGNED: 'Bắt đầu kiểm tra', 
    INSPECTING: 'Xác định phương án', 
    WAITING_APPROVAL: 'Đang chờ khách hàng phản hồi',
    REPAIRING: 'Đang sửa chữa & Thay thế', 
    WAITING_PART: 'Đang chờ linh kiện về kho', 
    WAITING_HANDOVER: 'Chờ bàn giao khách hàng',
  }
  return labels[status] ?? ticketStatusLabels[status]
}