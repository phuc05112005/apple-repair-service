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
  );
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
  );
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
    {work.isLoading ? <LoadingState label="Đang tải công việc…" /> : work.isError ? <ErrorState error={work.error} retry={() => work.refetch()} /> : !work.data?.length ? <EmptyState title="Hiện không có phiếu được phân công" /> : <div className="appointment-list">{work.data.map(ticket => <article key={ticket.ticketId}><div><span className="record-code">Phiếu #{ticket.ticketId}</span><h3>{ticket.deviceModelName} · {ticket.customerFullName}</h3><p>{ticket.serviceIssues.join(', ') || ticket.requestedServices.join(', ')} · Tiếp nhận lúc {formatDateTime(ticket.receivedAt)}</p><small>Dự kiến {ticket.estimatedDurationMinutes} phút</small></div><div><StatusBadge label={ticketStatusLabels[ticket.status]} tone="info" /><Link className="button button--primary" to={`tickets/${ticket.ticketId}`}>Xử lý</Link></div></article>)}</div>}
  </div>
}

export function InternalModulePage({ role, title, note }: { role: UserRole; title: string; note?: string }) {
  return <div className="workspace-page"><header><span className="eyebrow">{role === 'ADMIN' ? 'Quản trị' : role === 'RECEPTIONIST' ? 'Nhân viên tiếp nhận' : 'Kỹ thuật viên'}</span><h1>{title}</h1><p>{note ?? 'Chọn một mục trong thanh điều hướng để tiếp tục công việc.'}</p></header><div className="phase-notice"><strong>Chức năng đang được hoàn thiện</strong><p>Vui lòng quay lại sau.</p></div></div>
}

function WorkspaceCard({ number, title, text, to }: { number: string; title: string; text: string; to: string }) {
  return <Link className="workspace-card" to={to}><span>{number}</span><h2>{title}</h2><p>{text}</p><i aria-hidden="true">→</i></Link>
}
