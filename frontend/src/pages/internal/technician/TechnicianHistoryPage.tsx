import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { ServiceTicketStatus, OperationalTicketResponse } from '../../../api/contracts'
import { technicianApi } from '../../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { TicketTimingSummary } from '../../../components/TicketTimingSummary'
import { useBusinessNow } from '../../../hooks/useBusinessNow'
import { ticketStatusLabels } from '../../../types/labels'
import { formatDateTime } from '../../../utils/format'

interface TechnicianHistoryTicket {
  ticketId?: number
  serviceTicketId?: number
  id?: number
  customerFullName?: string
  deviceModelName?: string
  serviceIssues?: string[]
  requestedServices?: string[]
  receivedAt: string
  estimatedDurationMinutes?: number | null
  timing?: OperationalTicketResponse['timing']
  status: ServiceTicketStatus
}

export default function TechnicianHistoryPage() {
  const now = useBusinessNow()
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Trạng thái phân trang
  const [page, setPage] = useState<number>(1)
  const pageSize = 10

  // Gọi API Lịch sử ca sửa từ Backend
  const historyQuery = useQuery({
    queryKey: ['internal', 'technician', 'history', statusFilter],
    queryFn: ({ signal }) => 
      technicianApi.history(statusFilter === 'ALL' ? undefined : (statusFilter as ServiceTicketStatus), signal),
  })

  // Lọc và sắp xếp danh sách phiếu (đã bổ sung lọc trùng ID)
  const historyTickets = useMemo(() => {
    if (!historyQuery.data) return []
    let list: TechnicianHistoryTicket[] = [...historyQuery.data]

    // 1. Loại bỏ các bản ghi trùng ID phiếu (Deduplicate)
    const seen = new Set<number>()
    list = list.filter((t: TechnicianHistoryTicket) => {
      const id = t.ticketId ?? t.serviceTicketId ?? t.id
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })

    // 2. Lọc theo từ khóa tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((t: TechnicianHistoryTicket) => {
        const idStr = (t.ticketId ?? t.serviceTicketId ?? t.id ?? '').toString()
        return idStr.includes(q) ||
          (t.customerFullName && t.customerFullName.toLowerCase().includes(q)) ||
          (t.deviceModelName && t.deviceModelName.toLowerCase().includes(q))
      })
    }

    // 3. Sắp xếp danh sách
    list.sort((a: TechnicianHistoryTicket, b: TechnicianHistoryTicket) => {
      const timeA = new Date(a.receivedAt).getTime()
      const timeB = new Date(b.receivedAt).getTime()
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB
    })

    return list
  }, [historyQuery.data, searchQuery, sortOrder])

  // Tính toán chỉ số phân trang
  const totalItems = historyTickets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const paginatedTickets = useMemo(() => {
    return historyTickets.slice(startIndex, endIndex)
  }, [historyTickets, startIndex, endIndex])

  return (
    <div className="workspace-page workspace-page--focused">
      <header>
        <span className="eyebrow">Lịch sử cá nhân</span>
        <h1>Lịch sử phiếu sửa chữa.</h1>
        <p>Danh sách tất cả các phiếu dịch vụ bạn đã từng tiếp nhận, xử lý hoàn thành hoặc hủy ca.</p>
      </header>

      {/* THANH BỘ LỌC VÀ TÌM KIẾM */}
      <section className="ops-section" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <input 
              type="text"
              placeholder="Tìm theo Mã phiếu, Khách hàng, Model..." 
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select 
              value={statusFilter} 
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '0.9rem' }}
            >
              <option value="ALL">Tất cả trạng thái lịch sử ({historyQuery.data?.length ?? 0})</option>
              <option value="HANDED_OVER">Hoàn tất & Đã bàn giao</option>
              <option value="WAITING_HANDOVER">Đã sửa xong - Chờ bàn giao</option>
              <option value="CANCELLED">Đã hủy ca sửa</option>
            </select>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select 
              value={sortOrder} 
              onChange={e => {
                setSortOrder(e.target.value as 'NEWEST' | 'OLDEST')
                setPage(1)
              }}
              style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '0.9rem' }}
            >
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>

          {(searchQuery || statusFilter !== 'ALL' || sortOrder !== 'NEWEST') && (
            <button 
              type="button" 
              className="button button--quiet" 
              onClick={() => { 
                setSearchQuery('')
                setStatusFilter('ALL')
                setSortOrder('NEWEST')
                setPage(1)
              }}
              style={{ height: '38px', padding: '0 14px' }}
            >
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* DANH SÁCH PHIẾU LỊCH SỬ */}
      {historyQuery.isLoading ? (
        <LoadingState label="Đang tải lịch sử phiếu sửa chữa…" />
      ) : historyQuery.isError ? (
        <ErrorState error={historyQuery.error as Error} />
      ) : !historyTickets.length ? (
        <EmptyState title={searchQuery || statusFilter !== 'ALL' ? "Không tìm thấy phiếu lịch sử phù hợp với bộ lọc" : "Chưa có phiếu sửa chữa nào trong lịch sử"} />
      ) : (
        <>
          <div className="appointment-list">
            {paginatedTickets.map((ticket: TechnicianHistoryTicket, index: number) => {
              const currentTicketId = ticket.ticketId ?? ticket.serviceTicketId ?? ticket.id ?? index

              return (
                <article 
                  key={`${currentTicketId}-${index}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}
                >
                  <div style={{ flex: '1 1 auto' }}>
                    <span className="record-code">Phiếu #{currentTicketId}</span>
                    <h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3>
                    <p>
                      {(ticket.serviceIssues && ticket.serviceIssues.length > 0 ? ticket.serviceIssues.join(', ') : '') ||
                       (ticket.requestedServices && ticket.requestedServices.length > 0 ? ticket.requestedServices.join(', ') : '') ||
                       'Dịch vụ sửa chữa'} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}
                    </p>
                    <small>Thời lượng dự kiến: {ticket.estimatedDurationMinutes ?? '--'} phút kỹ thuật</small>
                    <TicketTimingSummary timing={ticket.timing} status={ticket.status} now={now} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                    <StatusBadge 
                      label={ticketStatusLabels[ticket.status]} 
                      tone={ticket.status === 'HANDED_OVER' ? 'success' : ticket.status === 'CANCELLED' ? 'warning' : 'info'} 
                    />
                    <Link className="button button--quiet" to={`/internal/technician/tickets/${currentTicketId}`}>
                      Xem chi tiết
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          {/* THANH PHÂN TRANG */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', padding: '12px 0' }}>
              <button
                type="button"
                className="button button--quiet"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ height: '36px', padding: '0 16px', fontSize: '0.875rem' }}
              >
                ‹
              </button>

              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
                Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                className="button button--quiet"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ height: '36px', padding: '0 16px', fontSize: '0.875rem' }}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}