import { useState, useMemo } from 'react'
import { TicketTimingSummary } from '../../components/TicketTimingSummary'
import { useBusinessNow } from '../../hooks/useBusinessNow'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { UserRole } from '../../api/contracts'
import { technicianApi } from '../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { ticketStatusLabels } from '../../types/labels'
import { formatDateTime } from '../../utils/format'

export function AdminHomePage() {
  return (
    <div className="workspace-page">
      <header>
        <span className="eyebrow">Tổng quan</span>
        <h1>Quản lý và theo dõi hoạt động toàn hệ thống.</h1>
        <p>
          Chọn chi nhánh để quản lý dữ liệu vận hành, tồn kho, lịch hẹn,
          lịch làm việc kỹ thuật viên và theo dõi các chỉ số thống kê.
        </p>
      </header>
      <div className="workspace-grid">
        <WorkspaceCard
          number="01"
          title="Danh mục hệ thống"
          text="Quản lý thiết bị, model, vấn đề dịch vụ, loại dịch vụ, bảng giá và linh kiện."
          to="catalog"
        />

        <WorkspaceCard
          number="02"
          title="Kho linh kiện"
          text="Theo dõi tồn kho, khung giờ tiếp nhận và lịch làm việc của kỹ thuật viên."
          to="inventory"
        />

        <WorkspaceCard
          number="03"
          title="Thống kê & báo cáo"
          text="Theo dõi tình hình hoạt động, doanh thu và kết quả dịch vụ theo thời gian và chi nhánh."
          to="statistics"
        />
      </div>
    </div>
  )
}

export function ReceptionistHomePage() {
  return (
    <div className="workspace-page">
      <header>
        <span className="eyebrow">Điều phối dịch vụ</span>
        <h1>Quản lý quy trình tiếp nhận và xử lý dịch vụ.</h1>
        <p>
          Theo dõi lịch hẹn, tiếp nhận thiết bị, tạo phiếu dịch vụ,
          phân công kỹ thuật viên và hỗ trợ bàn giao sau sửa chữa.
        </p>
      </header>
      <div className="workspace-grid">
        <WorkspaceCard
          number="01"
          title="Quản lý lịch hẹn"
          text="Xác nhận lịch, thay đổi thời gian và ghi nhận trạng thái khách đến."
          to="appointments"
        />

        <WorkspaceCard
          number="02"
          title="Tiếp nhận thiết bị"
          text="Tiếp nhận khách đặt lịch trước hoặc khách đến trực tiếp và tạo phiếu dịch vụ."
          to="intake"
        />

        <WorkspaceCard
          number="03"
          title="Phiếu dịch vụ"
          text="Theo dõi tiến trình, phân công kỹ thuật viên, thanh toán và bàn giao thiết bị."
          to="tickets"
        />
      </div>
    </div>
  )
}

export function TechnicianHomePage() {
  const now = useBusinessNow()
  const client = useQueryClient()
  
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const work = useQuery({ 
    queryKey: ['internal', 'technician', 'work'], 
    queryFn: ({ signal }) => technicianApi.work(undefined, signal) 
  })

  const incoming = useQuery({ 
    queryKey: ['internal', 'transfers', 'incoming'], 
    queryFn: ({ signal }) => technicianApi.incomingTransfers(signal) 
  })
  
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: number; accept: boolean }) => 
      accept ? technicianApi.acceptTransfer(id) : technicianApi.rejectTransfer(id),
    onSuccess: async () => { 
      await Promise.all([
        client.invalidateQueries({ queryKey: ['internal', 'technician', 'work'] }), 
        client.invalidateQueries({ queryKey: ['internal', 'transfers', 'incoming'] })
      ]) 
    },
  })

  // Lọc và sắp xếp công việc đang xử lý
  const filteredWork = useMemo(() => {
    if (!work.data) return []
    let list = [...work.data]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(t => 
        t.ticketId.toString().includes(q) ||
        t.customerFullName.toLowerCase().includes(q) ||
        t.deviceModelName.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'ALL' && statusFilter !== 'TRANSFER_INCOMING') {
      list = list.filter(t => t.status === statusFilter)
    }

    list.sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime()
      const timeB = new Date(b.receivedAt).getTime()
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB
    })

    return list
  }, [work.data, searchQuery, statusFilter, sortOrder])

  const showIncomingTransfers = (statusFilter === 'ALL' || statusFilter === 'TRANSFER_INCOMING') && Boolean(incoming.data?.length)

  return (
    <div className="workspace-page workspace-page--focused">
      <header>
        <span className="eyebrow">Công việc của tôi</span>
        <h1>Phiếu được phân công.</h1>
        <p>Danh sách các phiếu dịch vụ cần xử lý và yêu cầu chuyển giao ca.</p>
      </header>

      {/* THANH BỘ LỌC CÔNG VIỆC HIỆN TẠI */}
      <section className="ops-section" style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <input 
              type="text"
              placeholder="Tìm theo Mã phiếu, Khách hàng, Model..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '0.9rem' }}
            >
              <option value="ALL">Tất cả trạng thái ({work.data?.length ?? 0})</option>
              {Boolean(incoming.data?.length) && (
                <option value="TRANSFER_INCOMING">⚠️ Yêu cầu chuyển giao ({incoming.data?.length})</option>
              )}
              <option value="ASSIGNED">Chờ xử lý ({work.data?.filter(t => t.status === 'ASSIGNED').length ?? 0})</option>
              <option value="REPAIRING">Đang sửa chữa ({work.data?.filter(t => t.status === 'REPAIRING').length ?? 0})</option>
              <option value="WAITING_PART">Chờ linh kiện ({work.data?.filter(t => t.status === 'WAITING_PART').length ?? 0})</option>
              <option value="WAITING_APPROVAL">Chờ khách xác nhận ({work.data?.filter(t => t.status === 'WAITING_APPROVAL').length ?? 0})</option>
            </select>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <select 
              value={sortOrder} 
              onChange={e => setSortOrder(e.target.value as 'NEWEST' | 'OLDEST')}
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
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setSortOrder('NEWEST'); }}
              style={{ height: '38px', padding: '0 14px' }}
            >
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* KHU VỰC YÊU CẦU CHUYỂN GIAO ĐẾN */}
      {showIncomingTransfers && (
        <section className="ops-section">
          <div className="ops-section__title">
            <span>!</span>
            <h2>Yêu cầu chuyển giao đến ({incoming.data?.length})</h2>
          </div>
          {incoming.data?.map(item => (
            <article className="recommendation" key={item.transfer.id}>
              <div>
                <strong>{item.ticket.ticketCode} · {item.ticket.deviceModelName}</strong>
                <StatusBadge label="Chờ phản hồi" tone="warning" />
              </div>
              <p><strong>Từ:</strong> {item.transfer.fromTechnicianName}</p>
              <p><strong>Lý do:</strong> {item.transfer.note}</p>
              <p><strong>Đã thực hiện:</strong> {item.transfer.workDone}</p>
              <p><strong>Tình trạng hiện tại:</strong> {item.transfer.currentCondition}</p>
              <div className="button-row">
                <button className="button button--primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.transfer.id, accept: true })}>Nhận việc</button>
                <button className="button button--quiet" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.transfer.id, accept: false })}>Từ chối</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {decide.isError && <ErrorState error={decide.error} />}

      {/* DANH SÁCH PHIẾU ĐANG XỬ LÝ */}
      {statusFilter !== 'TRANSFER_INCOMING' && (
        work.isLoading ? (
          <LoadingState label="Đang tải công việc…" />
        ) : work.isError ? (
          <ErrorState error={work.error} retry={() => work.refetch()} />
        ) : !filteredWork.length ? (
          <EmptyState title={searchQuery || statusFilter !== 'ALL' ? "Không tìm thấy phiếu phù hợp với bộ lọc" : "Hiện không có phiếu được phân công"} />
        ) : (
          <div className="appointment-list">
            {filteredWork.map((ticket, position) => (
              <article 
                key={ticket.ticketId}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}
              >
                <div style={{ flex: '1 1 auto' }}>
                  <span className="record-code">Phiếu #{ticket.ticketId}</span>
                  <h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3>
                  <p>{ticket.serviceIssues.join(', ') || ticket.requestedServices.join(', ')} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
                  <small>
                    {['WAITING_PART', 'WAITING_APPROVAL'].includes(ticket.status) 
                      ? 'Tạm chờ, không tính thời gian kỹ thuật' 
                      : `Thứ tự ${filteredWork.slice(0, position + 1).filter(row => !['WAITING_PART', 'WAITING_APPROVAL'].includes(row.status)).length}`} 
                    · {ticket.estimatedDurationMinutes == null ? 'Chưa xác định thời lượng' : `Dự kiến ${ticket.estimatedDurationMinutes} phút kỹ thuật`}
                  </small>
                  <TicketTimingSummary timing={ticket.timing} status={ticket.status} now={now} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                  <StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" />
                  <Link className="button button--primary" to={`tickets/${ticket.ticketId}`}>Xử lý</Link>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export function InternalModulePage({ role, title, note }: { role: UserRole; title: string; note?: string }) {
  return (
    <div className="workspace-page">
      <header>
        <span className="eyebrow">{role === 'ADMIN' ? 'Quản trị' : role === 'RECEPTIONIST' ? 'Nhân viên tiếp nhận' : 'Kỹ thuật viên'}</span>
        <h1>{title}</h1>
        <p>{note ?? 'Chọn một mục trong thanh điều hướng để tiếp tục công việc.'}</p>
      </header>
      <div className="phase-notice">
        <strong>Chức năng đang được hoàn thiện</strong>
        <p>Vui lòng quay lại sau.</p>
      </div>
    </div>
  )
}

function WorkspaceCard({ number, title, text, to }: { number: string; title: string; text: string; to: string }) {
  return (
    <Link className="workspace-card" to={to}>
      <span>{number}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <i aria-hidden="true">→</i>
    </Link>
  )
}