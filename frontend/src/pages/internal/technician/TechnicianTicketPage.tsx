import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AvailablePartResponse, InspectionRepairItemRequest, RepairItemResponse, ServiceTicketDetailResponse, WarrantyDecision } from '../../../api/contracts'
import { technicianApi } from '../../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { ticketStatusLabels } from '../../../types/labels'
import { formatDate, formatMoney } from '../../../utils/format'

export function TechnicianTicketPage() {
  const id = Number(useParams().ticketId)
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['internal', 'ticket', id], queryFn: ({ signal }) => technicianApi.ticket(id, signal), enabled: Number.isInteger(id) && id > 0, retry: false })
  const duration = useQuery({ queryKey: ['internal', 'duration', id], queryFn: ({ signal }) => technicianApi.duration(id, signal), enabled: Boolean(detail.data && !['HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)), retry: false })
  const parts = useQuery({ queryKey: ['internal', 'available-parts', id], queryFn: ({ signal }) => technicianApi.availableParts(id, undefined, signal), enabled: detail.data?.ticket.status === 'REPAIRING' })
  const candidates = useQuery({ queryKey: ['internal', 'transfer-candidates', id], queryFn: ({ signal }) => technicianApi.transferCandidates(id, signal), enabled: Boolean(detail.data && !['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(detail.data.ticket.status)) })
  const [inspectionResult, setInspectionResult] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [items, setItems] = useState<InspectionRepairItemRequest[]>([])
  const [partNote, setPartNote] = useState('')
  const [warrantyNotes, setWarrantyNotes] = useState<Record<number, string>>({})
  const [targetTechnicianId, setTargetTechnicianId] = useState<number>()
  const [transferNote, setTransferNote] = useState('')

  const proposedItems = items.length ? items : (detail.data?.repairItems.map(item => ({ serviceCatalogItemId: item.serviceCatalogItemId, basePrice: item.basePrice, finalPrice: item.finalPrice, warrantySourceItemId: item.warrantySourceItemId })) ?? [])
  const proposedResult = inspectionResult || detail.data?.ticket.inspectionResult || ''

  function acceptResult(updated: ServiceTicketDetailResponse) {
    queryClient.setQueryData(['internal', 'ticket', id], updated)
    void queryClient.invalidateQueries({ queryKey: ['internal', 'duration', id] })
    void queryClient.invalidateQueries({ queryKey: ['internal', 'technician', 'work'] })
  }
  const transition = useMutation({
    mutationFn: (kind: 'start' | 'inspect' | 'wait' | 'resume' | 'finish') => {
      if (kind === 'start') return technicianApi.startInspection(id)
      if (kind === 'inspect') return technicianApi.inspect(id, { inspectionResult: proposedResult, requiresCustomerApproval: requiresApproval, items: proposedItems })
      if (kind === 'wait') return technicianApi.waitForPart(id, partNote || undefined)
      if (kind === 'resume') return technicianApi.resume(id)
      return technicianApi.finish(id)
    }, onSuccess: acceptResult,
  })
  const warranty = useMutation({ mutationFn: ({ itemId, decision }: { itemId: number; decision: Exclude<WarrantyDecision, null> }) => technicianApi.warrantyDecision(itemId, decision, warrantyNotes[itemId]), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) })
  const transfer = useMutation({ mutationFn: () => technicianApi.requestTransfer(id, targetTechnicianId!, transferNote.trim() || undefined), onSuccess: async () => { setTargetTechnicianId(undefined); setTransferNote(''); await queryClient.invalidateQueries({ queryKey: ['internal', 'ticket', id] }) } })

  if (!Number.isInteger(id) || id <= 0) return <ErrorState error={new Error('Mã phiếu không hợp lệ')} />
  if (detail.isLoading) return <LoadingState label="Đang tải ticket workspace…" />
  if (detail.isError) return <ErrorState error={detail.error} retry={() => detail.refetch()} />
  if (!detail.data) return <EmptyState title="Không tìm thấy phiếu hoặc bạn không còn quyền truy cập" />
  const ticket = detail.data.ticket
  const context = detail.data.context

  return <div className="workspace-page ticket-workspace"><header className="ticket-header"><div><span className="record-code">{ticket.ticketCode}</span><h1>Xử lý phiếu dịch vụ</h1><p>{context.deviceModelName} · {context.customerFullName} · {formatDate(ticket.receivedAt)}</p></div><StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" /></header>
    <div className="tech-focus-bar"><div><span>Thời lượng đã sửa</span><strong>{duration.data ? `${duration.data.completedRepairMinutes + duration.data.currentRepairMinutes} phút` : 'Đang tính…'}</strong></div><div><span>Việc cần làm</span><strong>{nextAction(ticket.status)}</strong></div></div>
    {(transition.isError || warranty.isError || transfer.isError) && <ErrorState error={transition.error ?? warranty.error ?? transfer.error} />}
    <section className="ops-section"><div className="ops-section__title"><span>01</span><h2>Khách hàng & thiết bị</h2></div><dl className="record-grid"><div><dt>Khách hàng</dt><dd>{context.customerFullName}<br /><small>{context.customerPhone}</small></dd></div><div><dt>Thiết bị</dt><dd>{context.deviceModelName}<br /><small>{context.serialNumber || 'Chưa có số sê-ri'}{context.storage ? ` · ${context.storage}` : ''}</small></dd></div><div><dt>Vấn đề</dt><dd>{context.serviceIssues.join(', ')}</dd></div><div><dt>Dịch vụ yêu cầu</dt><dd>{context.requestedServices.join(', ')}</dd></div></dl>{context.symptomDescription && <div className="detail-note"><span>Mô tả thêm</span><p>{context.symptomDescription}</p></div>}<div className="detail-note"><span>Tình trạng khi nhận</span><p>{ticket.receivedCondition}</p></div>{ticket.inspectionResult && <div className="detail-note"><span>Kết quả kiểm tra hiện tại</span><p>{ticket.inspectionResult}</p></div>}</section>

    {ticket.status === 'ASSIGNED' && <section className="next-action-panel"><span>{ticketStatusLabels.ASSIGNED}</span><h2>Sẵn sàng bắt đầu kiểm tra?</h2><p>Bắt đầu kiểm tra để cập nhật trạng thái phiếu.</p><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('start')}>Bắt đầu kiểm tra</button></section>}
    {ticket.status === 'INSPECTING' && <section className="ops-section"><div className="ops-section__title"><span>02</span><h2>Kết quả & phương án xử lý</h2></div><label className="field"><span>Kết quả kiểm tra</span><textarea placeholder="Mô tả kết quả kiểm tra và hướng xử lý" maxLength={5000} value={proposedResult} onChange={event => setInspectionResult(event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={requiresApproval} onChange={event => setRequiresApproval(event.target.checked)} /><span>Phương án thay đổi đáng kể, cần khách hàng phê duyệt</span></label><div className="inspection-items">{detail.data.repairItems.map((item, index) => <article key={item.id}><div><span>Dịch vụ #{item.serviceCatalogItemId}</span><strong>{item.itemNameSnapshot}</strong></div><label className="field"><span>Giá ban đầu</span><input placeholder="Giá trước điều chỉnh" type="number" min="0" step="0.01" value={proposedItems[index]?.basePrice ?? ''} onChange={event => setItems(proposedItems.map((entry, i) => i === index ? { ...entry, basePrice: event.target.value === '' ? null : Number(event.target.value) } : entry))} /></label><label className="field"><span>Giá sau kiểm tra</span><input placeholder="Giá sau kiểm tra" type="number" min="0" step="0.01" value={proposedItems[index]?.finalPrice ?? ''} onChange={event => setItems(proposedItems.map((entry, i) => i === index ? { ...entry, finalPrice: event.target.value === '' ? null : Number(event.target.value) } : entry))} /></label></article>)}</div><button className="button button--primary" disabled={!proposedResult.trim() || !proposedItems.length || transition.isPending} onClick={() => transition.mutate('inspect')}>Lưu kết quả kiểm tra</button></section>}
    {ticket.status === 'WAITING_APPROVAL' && <section className="next-action-panel next-action-panel--waiting"><span>WAITING_APPROVAL</span><h2>Đang chờ khách hàng xác nhận.</h2><p>Nhân viên tiếp nhận ghi nhận quyết định; thao tác sửa chữa được khóa theo state machine.</p></section>}
    {ticket.status === 'REPAIRING' && <section className="next-action-panel"><span>{ticketStatusLabels.REPAIRING}</span><h2>Thiết bị đang được sửa chữa.</h2><div className="repair-admin-list">{detail.data.repairItems.filter(item => item.approvalStatus === 'APPROVED').map(item => <PartUsagePanel key={item.id} item={item} parts={parts.data ?? []} partsLoading={parts.isLoading} ticketId={id} />)}</div><label className="field"><span>Ghi chú khi chờ linh kiện <i>Không bắt buộc</i></span><textarea placeholder="Ghi chú về linh kiện đang chờ" value={partNote} onChange={event => setPartNote(event.target.value)} /></label><div className="button-row"><button className="button button--secondary" disabled={transition.isPending} onClick={() => transition.mutate('wait')}>Chuyển sang chờ linh kiện</button><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('finish')}>Hoàn tất sửa chữa</button></div></section>}
    {ticket.status === 'WAITING_PART' && <section className="next-action-panel next-action-panel--waiting"><span>WAITING_PART</span><h2>Linh kiện đã sẵn sàng?</h2><button className="button button--primary" disabled={transition.isPending} onClick={() => transition.mutate('resume')}>Tiếp tục sửa chữa</button></section>}

    <section className="ops-section"><div className="ops-section__title"><span>03</span><h2>Hạng mục & bảo hành</h2></div><div className="repair-admin-list">{detail.data.repairItems.map(item => <article key={item.id}><div><span>ITEM #{item.id}</span><h3>{item.itemNameSnapshot}</h3><p>{formatMoney(item.finalPrice)}</p></div><StatusBadge label={item.approvalStatus} tone={item.approvalStatus === 'APPROVED' ? 'success' : 'warning'} />{item.warrantySourceItemId && !item.warrantyDecision && <div className="approval-actions"><label className="field"><span>Ghi chú bảo hành</span><input placeholder="Ghi chú bảo hành (nếu có)" value={warrantyNotes[item.id] ?? ''} onChange={event => setWarrantyNotes(notes => ({ ...notes, [item.id]: event.target.value }))} /></label><button className="button button--primary" disabled={warranty.isPending} onClick={() => warranty.mutate({ itemId: item.id, decision: 'APPROVED' })}>Chấp nhận bảo hành</button><button className="button button--quiet" disabled={warranty.isPending} onClick={() => warranty.mutate({ itemId: item.id, decision: 'REJECTED' })}>Từ chối</button></div>}</article>)}</div></section>

    {!['WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED'].includes(ticket.status) && <section className="ops-section"><div className="ops-section__title"><span>04</span><h2>Chuyển giao công việc</h2></div>{candidates.isLoading ? <LoadingState /> : !candidates.data?.length ? <EmptyState title="Không có kỹ thuật viên khác trong ca" /> : <><label className="field"><span>Kỹ thuật viên nhận</span><select value={targetTechnicianId ?? ''} onChange={event => setTargetTechnicianId(Number(event.target.value) || undefined)}><option value="">Chọn kỹ thuật viên</option>{candidates.data.map(person => <option key={person.technicianId} value={person.technicianId} disabled={!person.eligible}>{person.technicianName} · workload {person.estimatedWorkloadMinutes} phút</option>)}</select></label><label className="field"><span>Ghi chú <i>Không bắt buộc</i></span><textarea placeholder="Ghi chú chuyển giao (nếu có)" value={transferNote} onChange={event => setTransferNote(event.target.value)} /></label><button className="button button--secondary" disabled={!targetTechnicianId || transfer.isPending} onClick={() => transfer.mutate()}>Gửi yêu cầu chuyển giao</button></>}</section>}
  </div>
}

function PartUsagePanel({ item, parts, partsLoading, ticketId }: { item: RepairItemResponse; parts: AvailablePartResponse[]; partsLoading: boolean; ticketId: number }) {
  const client = useQueryClient()
  const [partId, setPartId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const usages = useQuery({ queryKey: ['internal', 'part-usages', item.id], queryFn: ({ signal }) => technicianApi.partUsages(item.id, signal) })
  const usePart = useMutation({ mutationFn: () => technicianApi.usePart(item.id, partId!, quantity), onSuccess: async () => { setPartId(undefined); setQuantity(1); await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] })]) } })
  const reverse = useMutation({ mutationFn: (usageId: number) => technicianApi.reversePartUsage(usageId, 'Hoàn linh kiện từ ticket workspace'), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'part-usages', item.id] }), client.invalidateQueries({ queryKey: ['internal', 'available-parts', ticketId] })]) } })
  const selected = parts.find(part => part.partId === partId)
  return <article><div><span>HẠNG MỤC #{item.id}</span><h3>{item.itemNameSnapshot}</h3>{usages.data?.map(usage => { const part = parts.find(candidate => candidate.partId === usage.partId); return <p key={usage.id}>{part?.name ?? `Linh kiện #${usage.partId}`} × {usage.quantity} · {usage.status === 'USED' ? 'Đã dùng' : 'Đã hoàn tác'} {usage.status === 'USED' && <button className="text-action" disabled={reverse.isPending} onClick={() => reverse.mutate(usage.id)}>Hoàn tác</button>}</p> })}</div><div className="approval-actions"><label className="field"><span>Linh kiện tại chi nhánh</span><select disabled={partsLoading} value={partId ?? ''} onChange={event => setPartId(Number(event.target.value) || undefined)}><option value="">{partsLoading ? 'Đang tải…' : 'Chọn linh kiện'}</option>{parts.map(part => <option key={part.partId} value={part.partId} disabled={part.availableQuantity < 1}>{part.name} · {part.brand || 'Chưa rõ hãng'} {part.variant || ''} · tồn {part.availableQuantity}</option>)}</select></label><label className="field"><span>Số lượng</span><input placeholder="Nhập số lượng" type="number" min="1" max={selected?.availableQuantity ?? 1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><button className="button button--primary" disabled={!partId || quantity < 1 || quantity > (selected?.availableQuantity ?? 0) || usePart.isPending} onClick={() => usePart.mutate()}>Ghi nhận sử dụng</button></div>{(usePart.isError || reverse.isError || usages.isError) && <ErrorState error={usePart.error ?? reverse.error ?? usages.error} />}</article>
}

function nextAction(status: ServiceTicketDetailResponse['ticket']['status']) {
  const labels: Partial<Record<ServiceTicketDetailResponse['ticket']['status'], string>> = {
    ASSIGNED: 'Bắt đầu kiểm tra', INSPECTING: 'Ghi kết quả kiểm tra', WAITING_APPROVAL: 'Chờ khách xác nhận',
    REPAIRING: 'Tiếp tục sửa chữa', WAITING_PART: 'Chờ/tiếp tục sửa', WAITING_HANDOVER: 'Đã chuyển nhân viên tiếp nhận bàn giao',
  }
  return labels[status] ?? ticketStatusLabels[status]
}
