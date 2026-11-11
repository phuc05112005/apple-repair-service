import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { publicApi } from '../../api/publicApi'
import type { PublicRepairItemResponse, PublicTicketResponse, PublicTechnicianResponse, ServiceTicketStatus } from '../../api/contracts'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { appointmentStatusLabels, paymentStatusLabels, ticketStatusLabels } from '../../types/labels'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'

const processSteps: { status: ServiceTicketStatus; label: string }[] = [
  { status: 'WAITING_ASSIGNMENT', label: 'Đã tiếp nhận' },
  { status: 'REPAIRING', label: 'Đang sửa chữa' },
  { status: 'WAITING_HANDOVER', label: 'Chờ bàn giao' },
  { status: 'HANDED_OVER', label: 'Đã bàn giao' },
]
const stepIndex = (status: ServiceTicketStatus) => processSteps.findIndex(step => step.status === status)

function getTicketTechnicians(ticket: PublicTicketResponse): PublicTechnicianResponse[] {
  const map = new Map<string, PublicTechnicianResponse>()

  // 1. Ưu tiên lấy từ mảng technicians nếu Backend trả về danh sách KTV
  if (Array.isArray(ticket.technicians) && ticket.technicians.length > 0) {
    ticket.technicians.forEach(t => {
      if (t.name && t.name.trim() && t.name !== 'Chưa phân công') {
        map.set(t.name.trim(), {
          name: t.name.trim(),
          phone: t.phone || undefined,
          role: t.role || 'KTV Xử lý'
        })
      }
    })
  }

  // 2. Nếu Backend trả tên KTV đơn lẻ qua technicianName / technicianPhone
  if (ticket.technicianName && ticket.technicianName !== 'Chưa phân công' && !map.has(ticket.technicianName.trim())) {
    map.set(ticket.technicianName.trim(), {
      name: ticket.technicianName.trim(),
      phone: ticket.technicianPhone || undefined,
      role: 'KTV Phụ trách'
    })
  }

  return Array.from(map.values())
}

export function LookupPage() {
  const [mode, setMode] = useState<'phone' | 'code'>('phone')
  const [value, setValue] = useState('')
  const [lookup, setLookup] = useState<{ mode: 'phone' | 'code'; value: string }>()
  
  const phone = lookup?.mode === 'phone' ? lookup.value : ''
  
  const appointments = useQuery({ 
    queryKey: ['public', 'lookup', 'appointments', phone], 
    queryFn: ({ signal }) => publicApi.appointmentsByPhone(phone, signal), 
    enabled: Boolean(phone) 
  })
  
  const tickets = useQuery({ 
    queryKey: ['public', 'lookup', 'tickets', lookup], 
    queryFn: ({ signal }) => publicApi.tickets(lookup?.mode === 'phone' ? { phone: lookup.value } : { ticketCode: lookup?.value }, signal), 
    enabled: Boolean(lookup) 
  })

  // Chỉ lọc các lịch hẹn đang đặt (PENDING_CONFIRMATION) hoặc đã xác nhận (CONFIRMED)
  const activeAppointments = useMemo(() => {
    return appointments.data?.filter(item => 
      item.status === 'PENDING_CONFIRMATION' || item.status === 'CONFIRMED'
    ) ?? []
  }, [appointments.data])

  function submit(event: FormEvent) { 
    event.preventDefault()
    if (value.trim()) setLookup({ mode, value: value.trim() }) 
  }

  async function handleRefresh() {
    await Promise.all([
      appointments.refetch(),
      tickets.refetch()
    ])
  }

  const isRefreshing = appointments.isFetching || tickets.isFetching

  return (
    <div className="page-shell lookup-page section-pad">
      <header className="page-intro page-intro--compact">
        <span className="eyebrow">Tra cứu</span>
        <h1>Theo dõi dịch vụ của bạn</h1>
        <p>Xem lịch hẹn, tiến trình xử lý, thời gian dự kiến và thông tin bảo hành bằng dữ liệu thực tế từ phiếu dịch vụ.</p>
      </header>

      <section className="lookup-box">
        <div className="segmented" role="group" aria-label="Phương thức tra cứu">
          <button className={mode === 'phone' ? 'active' : ''} onClick={() => setMode('phone')}>Số điện thoại</button>
          <button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>Mã phiếu dịch vụ</button>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            <span>{mode === 'phone' ? 'Số điện thoại đã đăng ký' : 'Mã phiếu dịch vụ'}</span>
            <div className="search-input">
              <input 
                value={value} 
                onChange={event => setValue(event.target.value)} 
                inputMode={mode === 'phone' ? 'tel' : 'text'} 
                placeholder={mode === 'phone' ? 'Nhập số điện thoại' : 'Nhập mã phiếu dịch vụ'} 
              />
              <button className="button button--primary" disabled={!value.trim()}>Tra cứu</button>
            </div>
          </label>
        </form>
      </section>

      {lookup && (
        <div className="lookup-results">
          {lookup.mode === 'phone' && (
            <section>
              <div className="result-heading">
                <div>
                  <span className="eyebrow">Lịch hẹn</span>
                  Lịch hẹn đang đặt
                </div>
                <span>{activeAppointments.length} kết quả</span>
              </div>
              {appointments.isLoading ? (
                <LoadingState />
              ) : appointments.isError ? (
                <ErrorState error={appointments.error} retry={() => appointments.refetch()} />
              ) : !activeAppointments.length ? (
                <EmptyState title="Không có lịch hẹn nào đang đặt" />
              ) : (
                <div className="appointment-list">
                  {activeAppointments.map(item => (
                    <article key={item.appointmentId}>
                      <div>
                        <span className="record-code">LỊCH #{item.appointmentId}</span>
                        <h3>{item.branchName}</h3>
                        <p>{formatDate(item.date)} · {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}</p>
                        <small>Đặt lúc {formatDateTime(item.bookedAt)}</small>
                      </div>
                      <StatusBadge 
                        label={appointmentStatusLabels[item.status]} 
                        tone={item.status === 'CANCELLED' || item.status === 'EXPIRED' ? 'danger' : item.status === 'ARRIVED' ? 'success' : 'info'} 
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <div className="result-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">Phiếu dịch vụ</span>
                <h2>Tiến trình xử lý</h2>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  type="button" 
                  className="button button--quiet" 
                  onClick={handleRefresh} 
                  disabled={isRefreshing}
                  title="Cập nhật dữ liệu mới nhất"
                  aria-label="Cập nhật dữ liệu mới nhất"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '8px', 
                    width: '36px', 
                    height: '36px',
                    borderRadius: '50%'
                  }}
                >
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ 
                      transition: 'transform 0.4s ease',
                      animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                    }}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
                <span>{tickets.data?.length ?? 0} kết quả</span>
              </div>
            </div>

            {tickets.isLoading ? (
              <LoadingState />
            ) : tickets.isError ? (
              <ErrorState error={tickets.error} retry={() => tickets.refetch()} />
            ) : !tickets.data?.length ? (
              <EmptyState title="Không tìm thấy phiếu dịch vụ" />
            ) : (
              <div className="ticket-list">
                {tickets.data.map(ticket => (
                  <TicketCard key={ticket.ticketCode} ticket={ticket} phone={phone} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function TicketCard({ ticket, phone }: { ticket: PublicTicketResponse; phone?: string }) {
  // Mặc định thu gọn các thẻ phiếu khi tra cứu
  const [open, setOpen] = useState(false)
  
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(() => {
    return localStorage.getItem(`feedback_submitted_${ticket.ticketCode}`) === 'true'
  })

  const technicians = useMemo(() => getTicketTechnicians(ticket), [ticket])

  const current = stepIndex(ticket.status)
  const waiting = ticket.status === 'WAITING_APPROVAL' || ticket.status === 'WAITING_PART'

  const activeItems = ticket.repairItems.filter(item => item.approvalStatus !== 'REJECTED')
  const cancelledItems = ticket.repairItems.filter(item => item.approvalStatus === 'REJECTED')

  const getStepTime = (index: number) => {
    switch (index) {
      case 0: return ticket.receivedAt
      case 1: return ticket.inspectedAt
      case 2: return ticket.actualRepairStartedAt || ticket.timing?.actualRepairStartedAt
      case 3: return ticket.actualRepairCompletedAt || ticket.timing?.actualRepairCompletedAt
      case 4: return ticket.handedOverAt
      default: return null
    }
  }

  const displayEstimatedCompletion = useMemo(() => {
    // Nếu phiếu đang chờ phân công, không hiển thị mốc ngày giờ hoàn thành ảo
    if (ticket.status === 'WAITING_ASSIGNMENT') {
      return 'Chờ phân công'
    }

    const rawEst = ticket.estimatedCompletionAt || ticket.timing?.estimatedCompletionAt
    if (rawEst) return formatDateTime(rawEst)

    const durationMinutes = ticket.estimatedDurationMinutes || ticket.timing?.estimatedDurationMinutes
    if (ticket.receivedAt && durationMinutes) {
      const receivedDate = new Date(ticket.receivedAt)
      if (!isNaN(receivedDate.getTime())) {
        const completionDate = new Date(receivedDate.getTime() + durationMinutes * 60 * 1000)
        return formatDateTime(completionDate.toISOString())
      }
    }

    return 'Chưa có thời gian dự kiến'
  }, [ticket])

  const isFeedbackDone = ticket.hasFeedback || hasSubmittedFeedback

  return (
    <article className="ticket-card" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
      <button className="ticket-card__summary" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <div>
          <span className="record-code">Mã tra cứu: {ticket.ticketCode}</span>
          <h3>{ticket.deviceModelName}</h3>
          <p>{ticket.branchName} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge label={ticketStatusLabels[ticket.status]} tone={ticket.status === 'HANDED_OVER' ? 'success' : ticket.status === 'CANCELLED' ? 'danger' : 'info'} />
          <span className="expand-icon">{open ? '−' : '+'}</span>
        </div>
      </button>

      {open && (
        <div className="ticket-card__detail" style={{ padding: '20px' }}>
          <div className="ticket-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Thanh toán</span><br /><strong style={{ color: '#0f172a' }}>{paymentStatusLabels[ticket.paymentStatus]}</strong></div>
            <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Giá dịch vụ</span><br /><strong style={{ color: '#0f172a' }}>{formatMoney(ticket.approvedTotal)}</strong></div>
            <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Dự kiến hoàn thành</span><br /><strong style={{ color: '#0f172a' }}>{displayEstimatedCompletion}</strong></div>
          </div>

          {/* Khối hiển thị Kỹ thuật viên phụ trách & Chuyển giao ca */}
          {technicians.length > 0 ? (
            <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <strong style={{ color: '#0369a1', fontSize: '0.9rem' }}>
                  {technicians.length > 1 ? 'Kỹ thuật viên xử lý' : 'Kỹ thuật viên phụ trách'}
                </strong>
                {technicians.length > 1 && (
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {technicians.map((tech, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0f2fe',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      flexShrink: 0
                    }}>
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>{tech.name}</div>
                      {tech.phone ? (
                        <a href={`tel:${tech.phone}`} style={{ fontSize: '0.8rem', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {tech.phone}
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Chưa cập nhật SĐT</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                {ticket.status === 'WAITING_ASSIGNMENT'
                  ? 'Kỹ thuật viên: Đang chờ phân công'
                  : `Đội ngũ kỹ thuật viên ${ticket.branchName || 'chi nhánh'}`}
              </span>
            </div>
          )}

          <div className="timeline-public" style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0', paddingLeft: '4px' }}>
            {processSteps.map((step, index) => {
              const stepTime = getStepTime(index)
              const isDone = index <= current
              const isCurrent = index === current

              return (
                <div key={step.status} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isDone ? '#2563eb' : '#cbd5e1',
                    border: isCurrent ? '3px solid #bfdbfe' : 'none',
                    marginTop: '4px',
                    flexShrink: 0
                  }} />

                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.9rem', color: isDone ? '#0f172a' : '#94a3b8', fontWeight: isDone ? 600 : 500 }}>
                      {step.label}
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: isDone ? '#475569' : '#94a3b8' }}>
                      {stepTime 
                        ? formatDateTime(stepTime) 
                        : isCurrent 
                        ? 'Đang thực hiện' 
                        : isDone 
                        ? 'Đã hoàn thành' 
                        : 'Chưa thực hiện'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {waiting && (
            <div className="detail-note" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '12px 16px', borderRadius: '8px', color: '#b45309', marginBottom: '16px' }}>
              <span style={{ fontWeight: 600 }}>{ticket.status === 'WAITING_PART' ? 'Đang chờ linh kiện' : 'Đang liên hệ xác nhận phương án'}</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>{ticket.status === 'WAITING_PART' ? 'Kỹ thuật viên sẽ tiếp tục xử lý khi linh kiện sẵn sàng.' : 'Cửa hàng đang liên hệ để xác nhận phương án sửa chữa.'}</p>
            </div>
          )}


          <h4 style={{ marginTop: '20px', marginBottom: '12px', color: '#0f172a', fontSize: '1rem', fontWeight: 600 }}>Dịch vụ &amp; Linh kiện thực hiện</h4>
          <div className="repair-items">
            {activeItems.length === 0 ? (
              <p className="muted">Chưa có dịch vụ nào được duyệt.</p>
            ) : (
              activeItems.map(item => <RepairItem key={item.repairItemId} item={item} phone={phone} />)
            )}
          </div>

          {cancelledItems.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
              <h4 style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '12px' }}>Dịch vụ đã hủy / Đã đổi phương án khác</h4>
              <div className="repair-items">
                {cancelledItems.map(item => (
                  <RepairItem key={item.repairItemId} item={item} phone={phone} isCancelled />
                ))}
              </div>
            </div>
          )}

          {ticket.status === 'HANDED_OVER' && (
            isFeedbackDone ? (
              <div className="feedback-success" style={{ marginTop: '20px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontWeight: 500 }}>
                Bạn đã gửi đánh giá cho dịch vụ này. Cảm ơn phản hồi của bạn!
              </div>
            ) : (
              <FeedbackForm 
                ticketCode={ticket.ticketCode} 
                phone={phone} 
                onSuccess={() => {
                  localStorage.setItem(`feedback_submitted_${ticket.ticketCode}`, 'true')
                  setHasSubmittedFeedback(true)
                }} 
              />
            )
          )}
        </div>
      )}
    </article>
  )
}

function RepairItem({ item, phone, isCancelled = false }: { item: PublicRepairItemResponse; phone?: string; isCancelled?: boolean }) {
  const warranty = useQuery({ 
    queryKey: ['public', 'warranty', phone, item.repairItemId], 
    queryFn: ({ signal }) => publicApi.warrantyEligibility(phone!, item.repairItemId, signal), 
    enabled: Boolean(phone && !isCancelled) 
  })

  const warrantyBooking = `/booking?warrantySourceItem=${item.repairItemId}`
  const partDetails = [item.partBrand, item.partVariant].filter(Boolean).join(' · ')

  return (
    <div style={{ 
      opacity: isCancelled ? 0.65 : 1, 
      backgroundColor: isCancelled ? '#f8fafc' : '#ffffff',
      padding: '14px 16px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: '0.95rem', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#64748b' : '#0f172a' }}>
            {item.name}
          </strong>
          {isCancelled && (
            <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: 500 }}>
              Đã đổi phương án
            </span>
          )}
        </div>
        <span style={{ textDecoration: isCancelled ? 'line-through' : 'none', fontWeight: 600, fontSize: '0.95rem', color: isCancelled ? '#94a3b8' : '#0f172a' }}>
          {formatMoney(item.finalPrice)}
        </span>
      </div>

      {item.partName && (
        <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
          Linh kiện đi kèm: <strong>{item.partName}</strong> {partDetails ? `(${partDetails})` : ''}
        </p>
      )}

      {!isCancelled && (
        <div style={{ marginTop: '10px' }}>
          {!phone ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              Tra cứu bằng số điện thoại để kiểm tra hạn bảo hành &amp; đặt lịch bảo hành.
            </p>
          ) : warranty.isLoading ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#0284c7' }}>Đang kiểm tra bảo hành…</p>
          ) : warranty.data?.eligible ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '10px', 
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '8px 12px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#166534', fontWeight: 500, fontSize: '0.85rem' }}>
                Còn bảo hành {warranty.data.remainingDays} ngày (đến {formatDate(item.warrantyEndDate!)})
              </span>
              <Link 
                to={warrantyBooking} 
                state={{ warrantyPhone: phone }}
                style={{ 
                  backgroundColor: '#2563eb', 
                  color: '#ffffff', 
                  padding: '6px 14px', 
                  borderRadius: '6px', 
                  fontSize: '0.8rem', 
                  fontWeight: 500, 
                  textDecoration: 'none'
                }}
              >
                Đặt lịch bảo hành →
              </Link>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              {item.warrantyEndDate ? `Hết hạn bảo hành (${formatDate(item.warrantyEndDate)})` : 'Không áp dụng bảo hành'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackForm({ ticketCode, phone, onSuccess }: { ticketCode: string; phone?: string; onSuccess?: () => void }) {
  const [satisfied, setSatisfied] = useState<boolean>()
  const [comment, setComment] = useState('')
  
  const feedback = useMutation({ 
    mutationFn: () => publicApi.feedback(ticketCode, { phone: phone!, satisfied: satisfied!, comment: comment.trim() || undefined }),
    onSuccess: () => {
      if (onSuccess) onSuccess()
    }
  })

  if (!phone) return <p style={{ marginTop: '15px' }}>Tra cứu bằng số điện thoại để gửi phản hồi.</p>
  if (feedback.isSuccess) return <div className="feedback-success" style={{ marginTop: '15px' }}>Cảm ơn bạn đã gửi phản hồi.</div>

  return (
    <div className="feedback" style={{ marginTop: '20px' }}>
      <h4>Trải nghiệm dịch vụ của bạn thế nào?</h4>
      <div className="button-row">
        <button className={`button button--secondary ${satisfied === true ? 'selected' : ''}`} onClick={() => setSatisfied(true)}>
          Hài lòng
        </button>
        <button className={`button button--secondary ${satisfied === false ? 'selected' : ''}`} onClick={() => setSatisfied(false)}>
          Chưa hài lòng
        </button>
      </div>
      <label className="field">
        <span>Chia sẻ thêm <i>Không bắt buộc</i></span>
        <textarea placeholder="Nhập chia sẻ về trải nghiệm của bạn" maxLength={5000} value={comment} onChange={event => setComment(event.target.value)} />
      </label>
      {feedback.isError && <ErrorState error={feedback.error} />}
      <button className="button button--primary" disabled={satisfied === undefined || feedback.isPending} onClick={() => feedback.mutate()}>
        {feedback.isPending ? 'Đang gửi…' : 'Gửi phản hồi'}
      </button>
    </div>
  )
}