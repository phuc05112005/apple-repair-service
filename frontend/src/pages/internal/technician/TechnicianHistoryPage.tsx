import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { ServiceTicketStatus } from '../../../api/contracts'
import { technicianApi } from '../../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { TicketTimingSummary } from '../../../components/TicketTimingSummary'
import { useBusinessNow } from '../../../hooks/useBusinessNow'
import { ticketStatusLabels } from '../../../types/labels'
import { formatDateTime } from '../../../utils/format'

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

  // Lọc và sắp xếp danh sách phiếu
  const historyTickets = useMemo(() => {
    if (!historyQuery.data) return []
    let list = [...historyQuery.data]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(t => 
        t.ticketId.toString().includes(q) ||
        t.customerFullName.toLowerCase().includes(q) ||
        t.deviceModelName.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime()
      const timeB = new Date(b.receivedAt).getTime()
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB
    })

    return list
  }, [historyQuery.data, searchQuery, sortOrder])

  // Tính toán các chỉ số phân trang đơn giản
  const totalItems = historyTickets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  // Cắt danh sách phiếu theo trang hiện tại
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
              <option value="NEWEST">Mới nhất tiếp nhận</option>
              <option value="OLDEST">Cũ nhất tiếp nhận</option>
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
            {paginatedTickets.map(ticket => (
              <article 
                key={ticket.ticketId}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}
              >
                <div style={{ flex: '1 1 auto' }}>
                  <span className="record-code">Phiếu #{ticket.ticketId}</span>
                  <h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3>
                  <p>{ticket.serviceIssues.join(', ') || ticket.requestedServices.join(', ')} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
                  <small>Thời lượng dự kiến: {ticket.estimatedDurationMinutes ?? '--'} phút kỹ thuật</small>
                  <TicketTimingSummary timing={ticket.timing} status={ticket.status} now={now} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                  <StatusBadge 
                    label={ticketStatusLabels[ticket.status]} 
                    tone={ticket.status === 'HANDED_OVER' ? 'success' : ticket.status === 'CANCELLED' ? 'warning' : 'info'} 
                  />
                  <Link className="button button--quiet" to={`/internal/technician/tickets/${ticket.ticketId}`}>
                    Xem chi tiết
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* THANH PHÂN TRANG TINH GỌN */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', padding: '12px 0' }}>
              <button
                type="button"
                className="button button--quiet"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ height: '36px', padding: '0 16px', fontSize: '0.875rem' }}
              >
                ‹ Trước
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
                Sau ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}