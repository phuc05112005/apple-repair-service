import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { UserRole } from '../../api/contracts'
import { technicianApi } from '../../api/technicianApi'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { ticketStatusLabels } from '../../types/labels'
import { formatDate } from '../../utils/format'

export function AdminHomePage() {
  return <div className="workspace-page"><header><span className="eyebrow">Admin workspace</span><h1>Điều hành theo từng chi nhánh.</h1><p>Chọn ngữ cảnh chi nhánh trước khi xem thống kê, tồn kho, lịch hẹn và lịch kỹ thuật viên.</p></header><div className="workspace-grid"><WorkspaceCard number="01" title="Dữ liệu nền" text="Thiết bị, model, vấn đề, loại dịch vụ, danh mục và linh kiện." to="catalog" /><WorkspaceCard number="02" title="Vận hành chi nhánh" text="Tồn kho, khung giờ và lịch làm việc theo branch." to="inventory" /><WorkspaceCard number="03" title="Theo dõi kết quả" text="Thống kê trong khoảng thời gian và chi nhánh được chọn." to="statistics" /></div></div>
}

export function ReceptionistHomePage() {
  return <div className="workspace-page"><header><span className="eyebrow">Receptionist workspace</span><h1>Hôm nay cần xử lý gì?</h1><p>Quy trình tập trung từ lịch hẹn đến tiếp nhận, phân công, thanh toán và bàn giao.</p></header><div className="workspace-grid"><WorkspaceCard number="01" title="Lịch hẹn" text="Xác nhận, đổi lịch, ghi nhận khách đến hoặc hết hạn." to="appointments" /><WorkspaceCard number="02" title="Tiếp nhận" text="Tạo phiếu từ lịch hẹn hoặc khách đến trực tiếp." to="intake" /><WorkspaceCard number="03" title="Phiếu dịch vụ" text="Theo dõi, phân công, thanh toán và bàn giao theo trạng thái." to="tickets" /></div></div>
}

export function TechnicianHomePage() {
  const client = useQueryClient()
  const work = useQuery({ queryKey: ['internal', 'technician', 'work'], queryFn: ({ signal }) => technicianApi.work(undefined, signal) })
  const incoming = useQuery({ queryKey: ['internal', 'transfers', 'incoming'], queryFn: ({ signal }) => technicianApi.incomingTransfers(signal) })
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: number; accept: boolean }) => accept ? technicianApi.acceptTransfer(id) : technicianApi.rejectTransfer(id),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['internal', 'technician', 'work'] }), client.invalidateQueries({ queryKey: ['internal', 'transfers', 'incoming'] })]) },
  })
  return <div className="workspace-page workspace-page--focused"><header><span className="eyebrow">Công việc của tôi</span><h1>Phiếu được phân công.</h1><p>Danh sách được xác định từ tài khoản kỹ thuật viên đang đăng nhập.</p></header>
    {incoming.data?.length ? <section className="ops-section"><div className="ops-section__title"><span>!</span><h2>Yêu cầu chuyển giao đến</h2></div>{incoming.data.map(item => <article className="recommendation" key={item.transfer.id}><div><strong>{item.ticket.ticketCode} · {item.ticket.deviceModelName}</strong><StatusBadge label="Chờ phản hồi" tone="warning" /></div><p>Từ {item.transfer.fromTechnicianName}{item.transfer.note ? ` · ${item.transfer.note}` : ''}</p><div className="button-row"><button className="button button--primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.transfer.id, accept: true })}>Nhận việc</button><button className="button button--quiet" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.transfer.id, accept: false })}>Từ chối</button></div></article>)}</section> : null}
    {decide.isError && <ErrorState error={decide.error} />}
    {work.isLoading ? <LoadingState label="Đang tải công việc…" /> : work.isError ? <ErrorState error={work.error} retry={() => work.refetch()} /> : !work.data?.length ? <EmptyState title="Hiện không có phiếu được phân công" /> : <div className="appointment-list">{work.data.map(ticket => <article key={ticket.ticketId}><div><span className="record-code">{ticket.ticketCode}</span><h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3><p>{ticket.serviceIssues.join(', ') || ticket.requestedServices.join(', ')} · Tiếp nhận {formatDate(ticket.receivedAt)}</p><small>Dự kiến {ticket.estimatedDurationMinutes} phút</small></div><div><StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" /><Link className="button button--primary" to={`tickets/${ticket.ticketId}`}>Xử lý</Link></div></article>)}</div>}
  </div>
}

export function InternalModulePage({ role, title, note }: { role: UserRole; title: string; note?: string }) {
  return <div className="workspace-page"><header><span className="eyebrow">{role === 'ADMIN' ? 'Quản trị' : role === 'RECEPTIONIST' ? 'Vận hành lễ tân' : 'Kỹ thuật viên'}</span><h1>{title}</h1><p>{note ?? 'Module chỉ hiển thị hành động được backend cho phép.'}</p></header><div className="phase-notice"><strong>Module đang được hoàn thiện</strong><p>Route và role guard đã hoạt động; dữ liệu giả không được sử dụng.</p></div></div>
}

function WorkspaceCard({ number, title, text, to }: { number: string; title: string; text: string; to: string }) {
  return <Link className="workspace-card" to={to}><span>{number}</span><h2>{title}</h2><p>{text}</p><i aria-hidden="true">→</i></Link>
}
