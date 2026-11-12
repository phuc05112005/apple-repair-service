import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { OperationalTicketResponse, ServiceTicketStatus } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { useBusinessNow } from '../../../hooks/useBusinessNow'
import { ticketStatusLabels, ticketStatusTones } from '../../../types/labels'
import { formatDateTime } from '../../../utils/format'
import { timingAttention } from '../../../utils/timing'

const statuses: ServiceTicketStatus[] = [
  'WAITING_ASSIGNMENT',
  'ASSIGNED',
  'INSPECTING',
  'WAITING_APPROVAL',
  'REPAIRING',
  'WAITING_PART',
  'WAITING_HANDOVER',
  'HANDED_OVER',
  'CANCELLED',
]

type TicketSortOrder = 'ATTENTION' | 'NEWEST' | 'OLDEST'
type AssignmentFilter = 'ALL' | 'UNASSIGNED' | 'ASSIGNED'

type TicketWithOptionalTechFields = OperationalTicketResponse & {
  technicianName?: string | null
  assignedTechnicianName?: string | null
  latestTechnicianName?: string | null
}

function resolveTechnicianName(ticket: OperationalTicketResponse): string | null {
  const t = ticket as TicketWithOptionalTechFields
  const name =
    t.activeTechnicianName ??
    t.technicianName ??
    t.assignedTechnicianName ??
    t.latestTechnicianName
  return name && name.trim() ? name.trim() : null
}

export function TicketsPage() {
  const now = useBusinessNow()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ServiceTicketStatus | ''>('')
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('ALL')
  const [sortOrder, setSortOrder] = useState<TicketSortOrder>('ATTENTION')

  // Trạng thái phân trang
  const [page, setPage] = useState<number>(1)
  const pageSize = 10

  const tickets = useQuery({
    queryKey: ['internal', 'tickets', status, search],
    queryFn: ({ signal }) =>
      receptionistApi.tickets(
        {
          status: status || undefined,
          query: search.trim() || undefined,
        },
        signal,
      ),
  })

  // Danh sách chi nhánh thực tế có trong dữ liệu phiếu
  const branchOptions = useMemo(() => {
    if (!tickets.data) return []
    const set = new Set<string>()
    tickets.data.forEach(t => {
      if (t.branchName && t.branchName.trim()) {
        set.add(t.branchName.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [tickets.data])

  // Lọc trùng, áp dụng bộ lọc chi tiết và sắp xếp
  const filteredTickets = useMemo(() => {
    if (!tickets.data) return []

    // 1. Loại bỏ bản ghi trùng ticketId (nếu có)
    const seen = new Set<number>()
    let list = tickets.data.filter(t => {
      if (!t.ticketId || seen.has(t.ticketId)) return false
      seen.add(t.ticketId)
      return true
    })

    // 2. Lọc theo chi nhánh
    if (branchFilter !== 'ALL') {
      list = list.filter(t => t.branchName === branchFilter)
    }

    // 3. Lọc theo trạng thái phân công kỹ thuật viên
    if (assignmentFilter === 'UNASSIGNED') {
      list = list.filter(t => !resolveTechnicianName(t))
    } else if (assignmentFilter === 'ASSIGNED') {
      list = list.filter(t => Boolean(resolveTechnicianName(t)))
    }

    // 4. Sắp xếp
    list = [...list].sort((a, b) => {
      if (sortOrder === 'ATTENTION') {
        return timingAttention(a.status, a.timing, now) - timingAttention(b.status, b.timing, now)
      }
      const timeA = new Date(a.receivedAt).getTime()
      const timeB = new Date(b.receivedAt).getTime()
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB
    })

    return list
  }, [tickets.data, branchFilter, assignmentFilter, sortOrder, now])

  // Tính toán chỉ số phân trang
  const totalItems = filteredTickets.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice(startIndex, endIndex)
  }, [filteredTickets, startIndex, endIndex])

  const hasActiveFilters =
    search.trim() !== '' ||
    status !== '' ||
    branchFilter !== 'ALL' ||
    assignmentFilter !== 'ALL' ||
    sortOrder !== 'ATTENTION'

  const resetFilters = () => {
    setSearch('')
    setStatus('')
    setBranchFilter('ALL')
    setAssignmentFilter('ALL')
    setSortOrder('ATTENTION')
    setPage(1)
  }

  return (
    <div className="workspace-page">
      <header>
        <span className="eyebrow">Phiếu dịch vụ</span>
        <h1>Danh sách phiếu dịch vụ</h1>
        <p>Tìm theo mã phiếu, khách hàng, số điện thoại hoặc dòng máy.</p>
      </header>

      {/* THANH BỘ LỌC VÀ TÌM KIẾM */}
      <section
        className="ops-section"
        style={{
          padding: '16px',
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Nhập mã phiếu, tên, SĐT hoặc dòng máy..."
              value={search}
              onChange={event => {
                setSearch(event.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value as ServiceTicketStatus | '')
                setPage(1)
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                background: '#fff',
                fontSize: '0.9rem',
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {statuses.map(item => (
                <option key={item} value={item}>
                  {ticketStatusLabels[item]}
                </option>
              ))}
            </select>
          </div>

          {branchOptions.length > 1 && (
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={branchFilter}
                onChange={event => {
                  setBranchFilter(event.target.value)
                  setPage(1)
                }}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e0',
                  background: '#fff',
                  fontSize: '0.9rem',
                }}
              >
                <option value="ALL">Tất cả chi nhánh</option>
                {branchOptions.map(branch => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ flex: '0 0 auto' }}>
            <select
              value={assignmentFilter}
              onChange={event => {
                setAssignmentFilter(event.target.value as AssignmentFilter)
                setPage(1)
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                background: '#fff',
                fontSize: '0.9rem',
              }}
            >
              <option value="ALL">Tất cả phân công</option>
              <option value="UNASSIGNED">Chưa phân công</option>
              <option value="ASSIGNED">Đã phân công</option>
            </select>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select
              value={sortOrder}
              onChange={event => {
                setSortOrder(event.target.value as TicketSortOrder)
                setPage(1)
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                background: '#fff',
                fontSize: '0.9rem',
              }}
            >
              <option value="ATTENTION">Ưu tiên cần xử lý</option>
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="button button--quiet"
              onClick={resetFilters}
              style={{ height: '38px', padding: '0 14px' }}
            >
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* DANH SÁCH PHIẾU DỊCH VỤ */}
      {tickets.isLoading ? (
        <LoadingState label="Đang tải phiếu dịch vụ…" />
      ) : tickets.isError ? (
        <ErrorState error={tickets.error} retry={() => tickets.refetch()} />
      ) : !filteredTickets.length ? (
        <EmptyState
          title={
            hasActiveFilters
              ? 'Không tìm thấy phiếu dịch vụ phù hợp với bộ lọc'
              : 'Chưa có phiếu dịch vụ nào'
          }
        />
      ) : (
        <>
          <div className="appointment-list">
            {paginatedTickets.map(ticket => {
              const techName = resolveTechnicianName(ticket)
              const isClosedTicket = ticket.status === 'HANDED_OVER' || ticket.status === 'CANCELLED'

              return (
                <article
                  key={ticket.ticketId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px',
                  }}
                >
                  <div style={{ flex: '1 1 auto' }}>
                    <span className="record-code">
                      Phiếu #{ticket.ticketId} · {ticket.ticketCode}
                    </span>
                    <h3>
                      {ticket.deviceModelName} · {ticket.customerFullName}
                    </h3>
                    <p>
                      {ticket.branchName} ·{' '}
                      {ticket.serviceIssues.join(', ') || 'Chưa có nhóm vấn đề'}
                    </p>
                    <p className="ticket-time">Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
                    <small>
                      {techName
                        ? `Kỹ thuật viên: ${techName}`
                        : isClosedTicket
                          ? 'Không ghi nhận KTV'
                          : 'Chưa phân công'}
                    </small>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge
                      label={ticketStatusLabels[ticket.status]}
                      tone={ticketStatusTones[ticket.status]}
                    />
                    <Link className="button button--secondary" to={`${ticket.ticketId}`}>
                      Mở phiếu
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          {/* THANH PHÂN TRANG */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginTop: '24px',
                padding: '12px 0',
              }}
            >
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