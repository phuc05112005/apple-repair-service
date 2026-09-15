import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ServiceTicketStatus } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { ticketStatusLabels } from '../../../types/labels'
import { formatDate } from '../../../utils/format'

const statuses: ServiceTicketStatus[] = ['WAITING_ASSIGNMENT', 'ASSIGNED', 'INSPECTING', 'WAITING_APPROVAL', 'REPAIRING', 'WAITING_PART', 'WAITING_HANDOVER', 'HANDED_OVER', 'CANCELLED']

export function TicketsPage() {
  const [status, setStatus] = useState<ServiceTicketStatus | ''>('')
  const [search, setSearch] = useState('')
  const tickets = useQuery({
    queryKey: ['internal', 'tickets', status, search],
    queryFn: ({ signal }) => receptionistApi.tickets({ status: status || undefined, query: search.trim() || undefined }, signal),
  })

  return <div className="workspace-page"><header><span className="eyebrow">Phiếu dịch vụ</span><h1>Hàng đợi vận hành.</h1><p>Tìm theo mã phiếu, khách hàng, số điện thoại hoặc model; dữ liệu được đọc trực tiếp từ backend.</p></header>
    <div className="filter-bar"><label className="field"><span>Tìm kiếm</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã phiếu, khách hàng, số điện thoại…" /></label><label className="field"><span>Trạng thái</span><select value={status} onChange={event => setStatus(event.target.value as ServiceTicketStatus | '')}><option value="">Tất cả trạng thái</option>{statuses.map(item => <option key={item} value={item}>{ticketStatusLabels[item]}</option>)}</select></label></div>
    {tickets.isLoading ? <LoadingState label="Đang tải phiếu dịch vụ…" /> : tickets.isError ? <ErrorState error={tickets.error} retry={() => tickets.refetch()} /> : !tickets.data?.length ? <EmptyState title="Không có phiếu phù hợp" /> : <div className="appointment-list">{tickets.data.map(ticket => <article key={ticket.ticketId}><div><span className="record-code">{ticket.ticketCode}</span><h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3><p>{ticket.branchName} · {ticket.serviceIssues.join(', ') || 'Chưa có nhóm vấn đề'} · {formatDate(ticket.receivedAt)}</p><small>{ticket.activeTechnicianName ? `KTV: ${ticket.activeTechnicianName}` : 'Chưa phân công'} · Dự kiến {ticket.estimatedDurationMinutes} phút</small></div><div><StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticket.status === 'HANDED_OVER' ? 'success' : ticket.status === 'CANCELLED' ? 'danger' : 'info'} /><Link className="button button--secondary" to={`${ticket.ticketId}`}>Mở phiếu</Link></div></article>)}</div>}
  </div>
}
