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

  const transfer = useMutation({ mutationFn: () => technicianApi.requestTransfer(id, targetTechnicianId!, transferNote.trim(), transferWorkDone.trim(), transferCondition.trim()), onSuccess: async () => { setTargetTechnicianId(undefined); setTransferNote(''); setTransferWorkDone(''); setTransferCondition(''); await queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) } })

  if (!Number.isInteger(id) || id <= 0) return <ErrorState error={new Error('Mã phiếu không hợp lệ')} />
  if (detail.isLoading) return <LoadingState label="Đang tải phiếu dịch vụ…" />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => detail.refetch()} />
  if (!detail.data) return <EmptyState title="Không tìm thấy phiếu hoặc bạn không còn quyền truy cập" />
  const ticket = detail.data.ticket
  const context = detail.data.context
  const currentEvent = detail.data.history.at(-1)
  const waitResolved = Boolean(currentEvent?.toStatus === ticket.status && currentEvent.resolvedAt)
  const pendingApprovalItems = detail.data.repairItems.filter(item => item.approvalStatus === 'PENDING')

  return <div className="workspace-page ticket-workspace"><header className="ticket-header"><div><span className="record-code">Phiếu #{ticket.id}</span><h1>Xử lý phiếu dịch vụ</h1><p>{context.deviceModelName} · {context.customerFullName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p></div><StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" /></header>
    <TicketTimingPanel ticket={ticket} canViewHistory={!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status)} /><div className="tech-focus-bar"><div><span>Thời lượng đã sửa</span><strong>{duration.data ? `${duration.data.currentRepairMinutes} phút` : 'Đang tính…'}</strong></div><div><span>Việc cần làm</span><strong>{nextAction(ticket.status)}</strong></div></div>
    {(transition.isError || transfer.isError || approval.isError || resolveWait.isError) && <ErrorState error={transition.error ?? transfer.error ?? approval.error ?? resolveWait.error} />}
    <section className="ops-section"><div className="ops-section__title"><span>01</span><h2>Khách hàng & thiết bị</h2></div><dl className="record-grid"><div><dt>Khách hàng</dt><dd>{context.customerFullName}<br /><small>{context.customerPhone}</small></dd></div><div><dt>Thiết bị</dt><dd>{context.deviceModelName}<br /><small>{context.serialNumber || 'Chưa có số sê-ri'}{context.storage ? ` · ${context.storage}` : ''}</small></dd></div><div><dt>Vấn đề</dt><dd>{context.serviceIssues.join(', ')}</dd></div><div><dt>Dịch vụ yêu cầu</dt><dd>{context.requestedServices.join(', ')}</dd></div></dl>{context.symptomDescription && <div className="detail-note"><span>Vấn đề khách mô tả ban đầu</span><p>{context.symptomDescription}</p></div>}<div className="detail-note"><span>Tình trạng khi nhận</span><p>{ticket.receivedCondition}</p></div>{ticket.inspectionResult && <div className="detail-note"><span>Kết quả kiểm tra hiện tại</span><p>{ticket.inspectionResult}</p></div>}</section>

    {ticket.status === 'ASSIGNED' && <section className="next-action-panel"><span>{ticketStatusLabels.ASSIGNED}</span><h2>Sẵn sàng bắt đầu kiểm tra?</h2><p>Bắt đầu kiểm tra để cập nhật trạng thái phiếu.</p><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('start')}>Bắt đầu kiểm tra</button></section>}
    {['INSPECTING', 'REPAIRING', 'WAITING_APPROVAL'].includes(ticket.status) && <InspectionPlanEditor
      modelId={context.deviceModelId} discountPercent={ticket.discountPercent}
      existingItems={detail.data.repairItems} items={proposedItems} onItemsChange={setItems}
      result={proposedResult} onResultChange={setInspectionResult}
      requiresApproval={requiresApproval} onApprovalChange={setRequiresApproval}
      confirmationMethod={confirmationMethod} confirmationNote={confirmationNote} authorizedScope={ticket.authorizedScope}
      onMethodChange={setConfirmationMethod} onNoteChange={setConfirmationNote}
      busy={transition.isPending} onSubmit={() => transition.mutate('inspect')}
    />}
    {ticket.status === 'WAITING_APPROVAL' && <section className="next-action-panel next-action-panel--waiting"><span>{ticketStatusLabels.WAITING_APPROVAL}</span>{pendingApprovalItems.length ? <><h2>Ghi nhận phản hồi của khách hàng.</h2><p>Phiếu vẫn ở trạng thái chờ sau khi ghi nhận. Kỹ thuật viên chủ động tiếp tục khi không có phiếu khác đang sửa.</p><label className="field"><span>Khách phản hồi lúc</span><input type="datetime-local" max={businessDateTimeInput()} value={waitResolvedAt} onChange={event => setWaitResolvedAt(event.target.value)} /></label>{pendingApprovalItems.map(item => <article className="wait-resolution-card" key={item.id}><h3>{item.itemNameSnapshot}</h3><ConfirmationFields method={approvalMethodByItem[item.id] ?? ''} note={approvalNoteByItem[item.id] ?? ''} scope={ticket.authorizedScope} onMethod={value => setApprovalMethodByItem(current => ({ ...current, [item.id]: value }))} onNote={value => setApprovalNoteByItem(current => ({ ...current, [item.id]: value }))} /><div className="button-row"><button className="button button--primary" disabled={approval.isPending || !approvalMethodByItem[item.id] || !waitResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'APPROVED' })}>Khách đồng ý</button><button className="button button--quiet" disabled={approval.isPending || !approvalMethodByItem[item.id] || !waitResolvedAt} onClick={() => approval.mutate({ itemId: item.id, decision: 'REJECTED' })}>Khách từ chối</button></div></article>)}</> : <><h2>Đã xác nhận – chờ kỹ thuật viên tiếp tục xử lý.</h2><p>Phản hồi đã được ghi nhận lúc {formatDateTime(currentEvent?.resolvedAt)}. Phiếu chưa tự động chiếm lại thời gian sửa.</p><button className="button button--primary" disabled={transition.isPending || !waitResolved} onClick={() => transition.mutate('resume')}>Tiếp tục sửa chữa</button></>}</section>}
    {ticket.status === 'REPAIRING' && <section className="next-action-panel"><span>{ticketStatusLabels.REPAIRING}</span><h2>Thiết bị đang được sửa chữa.</h2><div className="repair-admin-list">{detail.data.repairItems.filter(item => item.approvalStatus === 'APPROVED').map(item => <PartUsagePanel key={item.id} item={item} parts={parts.data ?? []} partsLoading={parts.isLoading} ticketId={id} />)}</div><label className="field"><span>Ghi chú khi chờ linh kiện <i>Không bắt buộc</i></span><textarea placeholder="Nhập ghi chú về linh kiện đang chờ" value={partNote} onChange={event => setPartNote(event.target.value)} /></label><div className="button-row"><button className="button button--secondary" disabled={transition.isPending} onClick={() => transition.mutate('wait')}>Chuyển sang chờ linh kiện</button><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('finish')}>Hoàn tất sửa chữa</button></div></section>}
    {ticket.status === 'WAITING_PART' && <section className="next-action-panel next-action-panel--waiting"><span>{ticketStatusLabels.WAITING_PART}</span>{waitResolved ? <><h2>Linh kiện đã sẵn sàng – chờ kỹ thuật viên tiếp tục xử lý.</h2><p>Điều kiện chờ kết thúc lúc {formatDateTime(currentEvent?.resolvedAt)}. Phiếu chưa tự động chuyển sang đang sửa.</p><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('resume')}>Tiếp tục sửa chữa</button></> : <><h2>Ghi nhận linh kiện đã sẵn sàng.</h2><label className="field"><span>Linh kiện sẵn sàng lúc</span><input type="datetime-local" max={businessDateTimeInput()} value={waitResolvedAt} onChange={event => setWaitResolvedAt(event.target.value)} /></label><label className="field"><span>Ghi chú <i>Không bắt buộc</i></span><textarea placeholder="Nhập ghi chú về linh kiện đã sẵn sàng" value={waitResolutionNote} onChange={event => setWaitResolutionNote(event.target.value)} /></label><button className="button button--primary" disabled={resolveWait.isPending || !waitResolvedAt} onClick={() => resolveWait.mutate()}>Ghi nhận đã sẵn sàng</button></>}</section>}

    <section className="ops-section"><div className="ops-section__title"><span>03</span><h2>Hạng mục & bảo hành</h2></div><div className="repair-admin-list">{detail.data.repairItems.map(item => <article key={item.id}><div><span>HẠNG MỤC #{item.id}</span><h3>{item.itemNameSnapshot}</h3><p>{formatMoney(item.finalPrice)}</p>{item.confirmationMethod && <small>{confirmationLabels[item.confirmationMethod]} · {formatDateTime(item.approvalDecisionAt)} · {item.approvalNote}</small>}{item.warrantyDecision && <p>{item.warrantyDecision === 'APPROVED' ? `Bảo hành miễn phí · ${item.warrantyRemedy === 'REPLACEMENT' ? 'Thay linh kiện' : 'Sửa chữa'}` : 'Không thuộc bảo hành. Bỏ hạng mục này khỏi phương án, sau đó thêm dịch vụ tính phí đã trao đổi với khách.'}</p>}</div><StatusBadge label={item.approvalStatus === 'APPROVED' ? 'Đã đồng ý' : item.approvalStatus === 'PENDING' ? 'Chờ liên hệ' : 'Không thực hiện'} tone={item.approvalStatus === 'APPROVED' ? 'success' : 'warning'} />{item.warrantySourceItemId && !item.warrantyDecision && item.approvalStatus !== 'REJECTED' && ['REPAIRING', 'WAITING_APPROVAL'].includes(ticket.status) && <WarrantyDecisionPanel item={item} modelId={context.deviceModelId} ticketId={id} onSaved={() => setItems(undefined)} />}</article>)}</div></section>

    {!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && <DefectiveInventoryPanel ticketId={id} />}
    {!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && <section className="ops-section"><div className="ops-section__title"><span>04</span><h2>Chuyển giao công việc</h2></div>{candidates.isLoading ? <LoadingState /> : !candidates.data?.length ? <EmptyState title="Không có kỹ thuật viên khác trong ca" /> : <><label className="field"><span>Kỹ thuật viên nhận</span><select value={targetTechnicianId ?? ''} onChange={event => setTargetTechnicianId(Number(event.target.value) || undefined)}><option value="">Chọn kỹ thuật viên</option>{candidates.data.map(person => <option key={person.technicianId} value={person.technicianId} disabled={!person.eligible}>{person.technicianName} · khối lượng {person.estimatedWorkloadMinutes} phút</option>)}</select></label><label className="field"><span>Lý do chuyển giao</span><textarea placeholder="Nhập lý do chuyển giao" value={transferNote} onChange={event => setTransferNote(event.target.value)} /></label><label className="field"><span>Công việc đã thực hiện</span><textarea placeholder="Nhập các công việc đã thực hiện" value={transferWorkDone} onChange={event => setTransferWorkDone(event.target.value)} /></label><label className="field"><span>Tình trạng thiết bị hiện tại</span><textarea placeholder="Nhập tình trạng thiết bị hiện tại" value={transferCondition} onChange={event => setTransferCondition(event.target.value)} /></label><button className="button button--secondary" disabled={!targetTechnicianId || !transferNote.trim() || !transferWorkDone.trim() || !transferCondition.trim() || transfer.isPending} onClick={() => transfer.mutate()}>Gửi yêu cầu chuyển giao</button></>}</section>}
    <section className="ops-section"><div className="ops-section__title"><span>05</span><h2>Mốc xử lý</h2></div><ol className="history-list">{detail.data.history.map(event => <li key={event.id}><span /><div><strong>{ticketStatusLabels[event.toStatus]}</strong><p><time dateTime={event.changedAt}>{formatDateTime(event.changedAt)}</time>{event.note ? ` · ${event.note === 'Intake' ? 'Tiếp nhận thiết bị' : event.note}` : ''}</p>{event.resolvedAt && <small>Điều kiện chờ kết thúc lúc {formatDateTime(event.resolvedAt)} · ghi nhận lúc {formatDateTime(event.resolutionRecordedAt)}{event.resolutionNote ? ` · ${event.resolutionNote}` : ''}</small>}</div></li>)}</ol></section>
  </div>
}

function PartUsagePanel({ item, parts, partsLoading, ticketId }: { item: RepairItemResponse; parts: AvailablePartResponse[]; partsLoading: boolean; ticketId: number }) {
  const client = useQueryClient()
  const [partId, setPartId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const [defectiveNote, setDefectiveNote] = useState('')
  const [collectDefective, setCollectDefective] = useState(false)
  const warrantyReplacement = item.warrantyRemedy === 'REPLACEMENT'
  const usages = useQuery({ queryKey: ['internal', 'part-usages', item.id], queryFn: ({ signal }) => technicianApi.partUsages(item.id, signal) })
  const usePart = useMutation({ mutationFn: () => technicianApi.usePart(item.id, partId!, quantity, warrantyReplacement || collectDefective ? defectiveNote.trim() : undefined), onSuccess: async () => { setPartId(undefined); setQuantity(1); await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] }), client.invalidateQueries({ queryKey: ['internal', 'defective', ticketId] })]) } })
  const reverse = useMutation({ mutationFn: (usageId: number) => technicianApi.reversePartUsage(usageId, 'Hoàn tác xuất linh kiện tốt chưa sử dụng'), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] }), client.invalidateQueries({ queryKey: ['internal', 'defective', ticketId] })]) } })
  const selected = parts.find(part => part.partId === partId)
  return <article><div><span>HẠNG MỤC #{item.id}</span><h3>{item.itemNameSnapshot}</h3>{usages.data?.map(usage => { const part = parts.find(candidate => candidate.partId === usage.partId); return <p key={usage.id}>{part?.name ?? `Linh kiện #${usage.partId}`} × {usage.quantity} · {usage.status === 'ACTIVE' ? 'Đã dùng' : 'Đã hoàn tác'} {usage.defectiveReturnNote && <small> · Thu hồi linh kiện lỗi × {usage.quantity}: {usage.defectiveReturnNote} · {formatDateTime(usage.usedAt)} · Không nhập kho sử dụng</small>} {usage.status === 'ACTIVE' && !usage.defectiveReturnNote && <button className="text-action" disabled={reverse.isPending} onClick={() => reverse.mutate(usage.id)}>Hoàn linh kiện tốt chưa dùng</button>}</p> })}</div><div className="approval-actions"><label className="field"><span>Linh kiện tại chi nhánh</span><select disabled={partsLoading} value={partId ?? ''} onChange={event => setPartId(Number(event.target.value) || undefined)}><option value="">{partsLoading ? 'Đang tải…' : 'Chọn linh kiện'}</option>{parts.filter(part => !item.expectedPartId || part.partId === item.expectedPartId).map(part => <option key={part.partId} value={part.partId} disabled={part.availableQuantity < 1}>{part.name} · {part.brand || 'Chưa rõ hãng'} {part.variant || ''} · tồn {part.availableQuantity}</option>)}</select></label><label className="field"><span>Số lượng</span><input placeholder="Nhập số lượng" type="number" min="1" max={selected?.availableQuantity ?? 1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label>{!warrantyReplacement && item.expectedPartId && <label className="check-field"><input type="checkbox" checked={collectDefective} onChange={e => setCollectDefective(e.target.checked)} /><span>Có thu hồi linh kiện lỗi từ khách</span></label>}{(warrantyReplacement || collectDefective) && <label className="field"><span>Linh kiện lỗi thu hồi</span><textarea placeholder="Nhập tên, mã nhận dạng và tình trạng linh kiện lỗi đã tháo" maxLength={5000} value={defectiveNote} onChange={event => setDefectiveNote(event.target.value)} /><small>Ghi nhận thu hồi cùng lần thay. Không cộng vào tồn kho có thể sử dụng.</small></label>}<button className="button button--primary" disabled={((warrantyReplacement || collectDefective) && !defectiveNote.trim()) || !partId || quantity < 1 || quantity > (selected?.availableQuantity ?? 0) || usePart.isPending} onClick={() => usePart.mutate()}>Ghi nhận sử dụng</button></div>{(usePart.isError || reverse.isError || usages.isError) && <ErrorState error={usePart.error ?? reverse.error ?? usages.error} />}</article>
}

function nextAction(status: ServiceTicketDetailResponse['ticket']['status']) {
  const labels: Partial<Record<ServiceTicketDetailResponse['ticket']['status'], string>> = {
    ASSIGNED: 'Bắt đầu kiểm tra', INSPECTING: 'Ghi kết quả kiểm tra', WAITING_APPROVAL: 'Ghi nhận phản hồi hoặc tiếp tục khi đã sẵn sàng',
    REPAIRING: 'Tiếp tục sửa chữa', WAITING_PART: 'Ghi nhận linh kiện sẵn sàng hoặc tiếp tục sửa', WAITING_HANDOVER: 'Đã chuyển nhân viên tiếp nhận bàn giao',
  }
  return labels[status] ?? ticketStatusLabels[status]
}
