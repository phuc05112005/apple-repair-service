import { DefectiveInventoryPanel } from '../../../components/DefectiveInventoryPanel'
import { TicketTimingPanel } from '../../../components/TicketTimingPanel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { WarrantyDecisionPanel } from '../../../components/WarrantyDecisionPanel'
import { confirmationLabels, ticketStatusLabels } from '../../../types/labels'
import type { ConfirmationMethod, AvailablePartResponse, InspectionRepairItemRequest, RepairItemResponse, ServiceTicketDetailResponse } from '../../../api/contracts'
import { InspectionPlanEditor } from '../../../components/InspectionPlanEditor'
import { technicianApi } from '../../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { formatDateTime, formatMoney } from '../../../utils/format'

export function TechnicianTicketPage() {
  const id = Number(useParams().ticketId)
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<'ACTION' | 'PLAN_PARTS' | 'TRANSFER' | 'TIMELINE'>('ACTION')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const detail = useQuery({ 
    queryKey: ['internal', 'ticket', id], 
    queryFn: ({ signal }) => technicianApi.ticket(id, signal), 
    enabled: Number.isInteger(id) && id > 0, 
    retry: false 
  })
  const duration = useQuery({ 
    queryKey: ['internal', 'duration', id], 
    queryFn: ({ signal }) => technicianApi.duration(id, signal), 
    enabled: Boolean(detail.data && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)), 
    retry: false 
  })
  const parts = useQuery({ 
    queryKey: ['internal', 'available-parts', id], 
    queryFn: ({ signal }) => technicianApi.availableParts(id, undefined, signal), 
    enabled: detail.data?.ticket.status === 'REPAIRING' 
  })
  const candidates = useQuery({ 
    queryKey: ['internal', 'transfer-candidates', id], 
    queryFn: ({ signal }) => technicianApi.transferCandidates(id, signal), 
    enabled: Boolean(detail.data && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)) 
  })

  const [inspectionResult, setInspectionResult] = useState('')
  const [confirmationMethod, setConfirmationMethod] = useState<ConfirmationMethod | ''>('')
  const [confirmationNote, setConfirmationNote] = useState('')
  const [items, setItems] = useState<InspectionRepairItemRequest[]>()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [targetTechnicianId, setTargetTechnicianId] = useState<number>()
  const [transferNote, setTransferNote] = useState('')
  const [transferWorkDone, setTransferWorkDone] = useState('')
  const [transferCondition, setTransferCondition] = useState('')
  const [waitResolutionNote, setWaitResolutionNote] = useState('')

  const proposedItems = items ?? (detail.data?.repairItems.filter(item => item.approvalStatus !== 'REJECTED').map(item => ({ 
    serviceCatalogItemId: item.serviceCatalogItemId, 
    basePrice: item.basePrice, 
    finalPrice: item.finalPrice, 
    warrantySourceItemId: item.warrantySourceItemId 
  })) ?? [])
  
  const proposedResult = inspectionResult || detail.data?.ticket.inspectionResult || ''

  function acceptResult(updated: ServiceTicketDetailResponse, targetTab?: 'ACTION' | 'PLAN_PARTS') {
    setItems(undefined); setConfirmationMethod(''); setConfirmationNote(''); setShowCancelModal(false); setCancelReason(''); setIsFormOpen(false)
    queryClient.setQueryData(['internal', 'ticket', id], updated)
    if (!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(updated.ticket.status)) {
      void queryClient.invalidateQueries({ queryKey: ['internal', 'duration', id] })
    }
    void queryClient.invalidateQueries({ queryKey: ['internal', 'time-estimates', id] })
    void queryClient.invalidateQueries({ queryKey: ['internal', 'technician', 'work'] })
    
    if (targetTab) {
      setActiveTab(targetTab)
    } else {
      setActiveTab('ACTION')
    }
  }

  const transition = useMutation({
    mutationFn: async (kind: 'start' | 'inspect-confirm' | 'inspect-pause' | 'wait' | 'resume' | 'finish' | 'cancel') => {
      if (kind === 'start') return technicianApi.startProcessing(id)
      
      if (kind === 'inspect-confirm') {
        const effectiveMethod = confirmationMethod || 'DIRECT'
        const effectiveResult = proposedResult.trim() || 'Đã kiểm tra và thống nhất phương án với khách hàng.'

        const res = await technicianApi.inspect(id, { 
          inspectionResult: effectiveResult, 
          requiresCustomerApproval: false, 
          items: proposedItems, 
          confirmationMethod: effectiveMethod, 
          confirmationNote: confirmationNote.trim() || undefined 
        })

        if (res.ticket.status === 'WAITING_APPROVAL' || res.ticket.status === 'WAITING_PART') {
          return await technicianApi.resume(id)
        }
        return res
      }

      if (kind === 'inspect-pause') {
        const effectiveResult = proposedResult.trim() || 'Đã kiểm tra và chờ xác nhận từ khách hàng.'
        return technicianApi.inspect(id, { 
          inspectionResult: effectiveResult, 
          requiresCustomerApproval: true, 
          items: proposedItems, 
          confirmationMethod: confirmationMethod || undefined, 
          confirmationNote: confirmationNote.trim() || undefined 
        })
      }

      if (kind === 'wait') return technicianApi.waitForPart(id, undefined)
      if (kind === 'resume') return technicianApi.resume(id)
      if (kind === 'cancel') return technicianApi.cancel(id, cancelReason.trim())
      return technicianApi.finish(id)
    }, 
    onSuccess: (updated, variables) => {
      if (variables === 'inspect-pause') {
        acceptResult(updated, 'PLAN_PARTS')
      } else {
        acceptResult(updated, 'ACTION')
      }
    },
  })

  const resolveWait = useMutation({
    mutationFn: async () => {
      const res = await technicianApi.resolveWait(id, undefined, waitResolutionNote.trim() || undefined)
      if (res.ticket.status === 'WAITING_PART') {
        return await technicianApi.resume(id)
      }
      return res
    },
    onSuccess: updated => acceptResult(updated, 'ACTION'),
  })

  const transfer = useMutation({
    mutationFn: () => technicianApi.requestTransfer(id, targetTechnicianId!, transferNote.trim(), transferWorkDone.trim(), transferCondition.trim()),
    onSuccess: async () => { 
      setTargetTechnicianId(undefined); setTransferNote(''); setTransferWorkDone(''); setTransferCondition(''); 
      await queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) 
    }
  })

  if (!Number.isInteger(id) || id <= 0) return <ErrorState error={new Error('Mã phiếu không hợp lệ')} />
  if (detail.isLoading) return <LoadingState label="Đang tải phiếu dịch vụ…" />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => detail.refetch()} />
  if (!detail.data) return <EmptyState title="Không tìm thấy phiếu hoặc bạn không còn quyền truy cập" />

  const ticket = detail.data.ticket
  const context = detail.data.context
  const canCancel = !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status)

  return (
    <div className="workspace-page ticket-workspace">
      <header className="ticket-header">
        <div>
          <span className="record-code">Phiếu #{ticket.id}</span>
          <h1>Xử lý phiếu dịch vụ</h1>
          <p>{context.deviceModelName} · {context.customerFullName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" />
          {canCancel && (
            <button className="button button--quiet" style={{ color: '#e53e3e', borderColor: '#feb2b2' }} onClick={() => setShowCancelModal(true)}>
              Hủy ca sửa
            </button>
          )}
        </div>
      </header>

      {showCancelModal && (
        <div style={{ margin: '15px 0', padding: '15px', border: '1px solid #feb2b2', borderRadius: '8px', background: '#fff5f5' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#c53030' }}>Xác nhận Hủy ca sửa chữa</h3>
          <label className="field">
            <span style={{ color: '#c53030', fontWeight: 'bold' }}>Lý do hủy ca sửa *</span>
            <textarea placeholder="Nhập lý do hủy ca sửa..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          </label>
          <div className="button-row" style={{ marginTop: '10px' }}>
            <button className="button" style={{ background: '#e53e3e', color: '#fff' }} disabled={!cancelReason.trim() || transition.isPending} onClick={() => transition.mutate('cancel')}>
              {transition.isPending ? 'Đang hủy…' : 'Xác nhận Hủy Phiếu'}
            </button>
            <button className="button button--quiet" onClick={() => setShowCancelModal(false)}>Quay lại</button>
          </div>
        </div>
      )}

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
          Phương án & Chờ xác nhận
        </button>
        {canCancel && (
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

      {(transition.isError || transfer.isError || resolveWait.isError) && (
        <ErrorState error={transition.error ?? transfer.error ?? resolveWait.error} />
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
            {ticket.inspectionResult && <div className="detail-note"><span>Kết quả chẩn đoán</span><p>{ticket.inspectionResult}</p></div>}
          </section>

          {ticket.status === 'ASSIGNED' && (
            <section className="next-action-panel">
              <span>{ticketStatusLabels.ASSIGNED}</span>
              <h2>Bắt đầu xử lý phiếu dịch vụ</h2>
              <p>Thực hiện kiểm tra, chẩn đoán và tháo lắp máy xử lý kỹ thuật.</p>
              <button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('start')}>Bắt đầu xử lý</button>
            </section>
          )}

          {ticket.status === 'WAITING_APPROVAL' && (
            <section className="next-action-panel next-action-panel--waiting">
              <span>{ticketStatusLabels.WAITING_APPROVAL}</span>
              <h2>Tạm dừng sửa chữa</h2>
              <div style={{ marginTop: '12px' }}>
                <button className="button button--primary" disabled={true}>
                  Tiếp tục sửa chữa
                </button>
                <small style={{ display: 'block', marginTop: '8px', color: '#718096', fontSize: '0.875rem' }}>
                  (Đang chờ xác nhận từ khách hàng)
                </small>
              </div>
              <div style={{ marginTop: '15px' }}>
                <button type="button" className="button button--secondary" onClick={() => { setActiveTab('PLAN_PARTS'); setIsFormOpen(true); }}>
                  Sang tab Phương án & Chờ xác nhận
                </button>
              </div>
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

              {/* BỘ NÚT ĐỒNG BỘ KIỂU DÁNG VÀ MÀU SẮC */}
              <div className="button-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
                <button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('finish')}>
                  Hoàn tất sửa chữa
                </button>
                <button className="button button--secondary" disabled={transition.isPending} onClick={() => transition.mutate('wait')}>
                  Chờ linh kiện
                </button>
                <button className="button button--secondary" disabled={transition.isPending} onClick={() => transition.mutate('inspect-pause')}>
                  Liên lạc khách & Chờ xác nhận
                </button>
              </div>
            </section>
          )}

          {ticket.status === 'WAITING_PART' && (
            <section className="next-action-panel next-action-panel--waiting">
              <span>{ticketStatusLabels.WAITING_PART}</span>
              <h2>Xác nhận linh kiện đã sẵn sàng</h2>
              <label className="field">
                <span>Ghi chú linh kiện</span>
                <textarea placeholder="Ghi chú thêm về linh kiện đã về kho..." value={waitResolutionNote} onChange={event => setWaitResolutionNote(event.target.value)} />
              </label>

              <div className="button-row" style={{ marginTop: '10px' }}>
                <button className="button button--primary" disabled={resolveWait.isPending} onClick={() => resolveWait.mutate()}>
                  {resolveWait.isPending ? 'Đang xử lý…' : 'Xác nhận linh kiện về & Tiếp tục sửa'}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* TAB 2: PHƯƠNG ÁN & CHỜ XÁC NHẬN */}
      {activeTab === 'PLAN_PARTS' && (
        <>
          {(ticket.status === 'WAITING_APPROVAL' || isFormOpen) ? (
            <InspectionPlanEditor
              status={ticket.status}
              modelId={context.deviceModelId} 
              discountPercent={ticket.discountPercent}
              existingItems={detail.data.repairItems} 
              items={proposedItems} 
              onItemsChange={setItems}
              result={proposedResult} 
              onResultChange={setInspectionResult}
              confirmationMethod={confirmationMethod} 
              confirmationNote={confirmationNote} 
              authorizedScope={ticket.authorizedScope}
              onMethodChange={setConfirmationMethod} 
              onNoteChange={setConfirmationNote}
              busy={transition.isPending} 
              onConfirm={() => transition.mutate('inspect-confirm')}
              onPause={() => transition.mutate('inspect-pause')}
              onCancel={ticket.status !== 'WAITING_APPROVAL' ? () => setIsFormOpen(false) : undefined}
            />
          ) : (
            <section className="ops-section">
              <div className="ops-section__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Phương án kỹ thuật hiện tại</h2>
                <button type="button" className="button button--secondary" onClick={() => setIsFormOpen(true)}>
                  + Cập nhật phương án / Liên lạc chờ khách xác nhận
                </button>
              </div>
            </section>
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

          {canCancel && <DefectiveInventoryPanel ticketId={id} />}
        </>
      )}

      {/* TAB 3: CHUYỂN GIAO CA */}
      {activeTab === 'TRANSFER' && canCancel && (
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
          <TicketTimingPanel ticket={ticket} canViewHistory={canCancel} />
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
  
  const isPureRepair = !item.expectedPartId && !warrantyReplacement

  const usages = useQuery({ queryKey: ['internal', 'part-usages', item.id], queryFn: ({ signal }) => technicianApi.partUsages(item.id, signal) })

  const compatibleParts = item.expectedPartId 
    ? parts.filter(part => part.partId === item.expectedPartId)
    : []

  const usePart = useMutation({ 
    mutationFn: () => technicianApi.usePart(item.id, partId!, quantity, warrantyReplacement || collectDefective ? defectiveNote.trim() : undefined), 
    onSuccess: async () => { 
      setPartId(undefined); setQuantity(1); setDefectiveNote(''); setCollectDefective(false);
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

  const selected = compatibleParts.find(part => part.partId === partId)

  return (
    <article className="repair-item-card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>HẠNG MỤC #{item.id}</span>
          <h3 style={{ margin: '4px 0 2px 0', fontSize: '1.1rem', fontWeight: 600, color: '#1a202c' }}>{item.itemNameSnapshot}</h3>
          <p style={{ margin: 0, fontWeight: 600, color: '#2b6cb0' }}>{formatMoney(item.finalPrice)}</p>
        </div>
        {isPureRepair ? (
          <span style={{ fontSize: '0.85rem', padding: '4px 10px', borderRadius: '12px', background: '#edf2f7', color: '#4a5568', fontWeight: 500 }}>
            Dịch vụ sửa chữa (Không dùng linh kiện kho)
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', padding: '4px 10px', borderRadius: '12px', background: '#ebf8ff', color: '#2b6cb0', fontWeight: 500 }}>
            Thay thế linh kiện
          </span>
        )}
      </div>

      {Boolean(usages.data?.length) && (
        <div style={{ marginTop: '10px', padding: '10px', background: '#f7fafc', borderRadius: '6px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#4a5568' }}>Linh kiện đã xuất:</strong>
          {usages.data?.map(usage => { 
            const part = parts.find(candidate => candidate.partId === usage.partId); 
            return (
              <p key={usage.id} style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                {part?.name ?? `Linh kiện #${usage.partId}`} × {usage.quantity} · {usage.status === 'ACTIVE' ? 'Đã xuất' : 'Đã hoàn tác'} 
                {usage.status === 'ACTIVE' && !usage.defectiveReturnNote && (
                  <button className="text-action" disabled={reverse.isPending} onClick={() => reverse.mutate(usage.id)} style={{ marginLeft: '10px' }}>
                    Hoàn kho linh kiện chưa dùng
                  </button>
                )}
              </p> 
            )
          })}
        </div>
      )}

      {!isPureRepair && (
        <div className="approval-actions" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #edf2f7' }}>
          {compatibleParts.length === 0 ? (
            <div style={{ color: '#c53030', background: '#fff5f5', padding: '10px 14px', borderRadius: '6px', fontSize: '0.9rem' }}>
              ⚠️ Linh kiện cấu hình cho dịch vụ này hiện chưa có sẵn trong kho chi nhánh.
            </div>
          ) : (
            <>
              <label className="field">
                <span>Linh kiện tồn kho chi nhánh</span>
                <select disabled={partsLoading} value={partId ?? ''} onChange={event => setPartId(Number(event.target.value) || undefined)}>
                  <option value="">{partsLoading ? 'Đang tải…' : 'Chọn linh kiện'}</option>
                  {compatibleParts.map(part => (
                    <option key={part.partId} value={part.partId} disabled={part.availableQuantity < 1}>
                      {part.name} · Tồn kho: {part.availableQuantity}
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
                  <span>Có thu hồi linh kiện cũ từ máy (báo đổi linh kiện lỗi)</span>
                </label>
              )}

              {(warrantyReplacement || collectDefective) && (
                <label className="field">
                  <span>Mô tả linh kiện lỗi thu hồi *</span>
                  <textarea placeholder="Tên/Mã và mô tả tình trạng linh kiện lỗi tháo ra..." maxLength={5000} value={defectiveNote} onChange={event => setDefectiveNote(event.target.value)} />
                </label>
              )}

              <button 
                className="button button--primary" 
                disabled={((warrantyReplacement || collectDefective) && !defectiveNote.trim()) || !partId || quantity < 1 || quantity > (selected?.availableQuantity ?? 0) || usePart.isPending} 
                onClick={() => usePart.mutate()}
                style={{ marginTop: '8px' }}
              >
                {usePart.isPending ? 'Đang xuất kho…' : 'Xác nhận xuất linh kiện'}
              </button>
            </>
          )}
        </div>
      )}

      {(usePart.isError || reverse.isError || usages.isError) && (
        <ErrorState error={usePart.error ?? reverse.error ?? usages.error} />
      )}
    </article>
  )
}

function nextAction(status: ServiceTicketDetailResponse['ticket']['status']) {
  const labels: Partial<Record<ServiceTicketDetailResponse['ticket']['status'], string>> = {
    ASSIGNED: 'Bắt đầu xử lý ca', 
    INSPECTING: 'Xác định phương án kỹ thuật', 
    WAITING_APPROVAL: 'Đang chờ khách hàng phản hồi',
    REPAIRING: 'Đang sửa chữa & Thay thế', 
    WAITING_PART: 'Đang chờ linh kiện về kho', 
    WAITING_HANDOVER: 'Chờ bàn giao khách hàng',
  }
  return labels[status] ?? ticketStatusLabels[status]
}