import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppointmentDetailResponse, AppointmentStatus } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { appointmentStatusLabels, appointmentStatusTones } from '../../../types/labels'
import { formatDateTime, formatMoney } from '../../../utils/format'

const statuses: AppointmentStatus[] = ['PENDING_CONFIRMATION', 'CONFIRMED', 'ARRIVED', 'CANCELLED', 'EXPIRED']

export function AppointmentsPage() {
  const queryClient = useQueryClient()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState(today)
  const [status, setStatus] = useState<AppointmentStatus>()
  const [selected, setSelected] = useState<AppointmentDetailResponse>()
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal) })
  const appointments = useQuery({ queryKey: ['internal', 'appointments', branchId, date, status], queryFn: ({ signal }) => receptionistApi.appointments({ branchId, date: date || undefined, status }, signal) })

  async function refresh(updated?: AppointmentDetailResponse) {
    if (updated) {
      setSelected(updated)
      queryClient.setQueryData(['internal', 'appointment', updated.appointment.id], updated)
    }
    await queryClient.invalidateQueries({ queryKey: ['internal', 'appointments'] })
  }

  return <div className="workspace-page"><header><span className="eyebrow">Vận hành trong ngày</span><h1>Lịch hẹn</h1><p>Xác nhận lịch, đổi lịch và ghi nhận khi khách đến chi nhánh.</p></header><div className="toolbar"><label><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Tất cả được phép</option>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label><span>Trạng thái</span><select value={status ?? ''} onChange={event => setStatus(event.target.value as AppointmentStatus || undefined)}><option value="">Tất cả</option>{statuses.map(item => <option value={item} key={item}>{appointmentStatusLabels[item]}</option>)}</select></label></div>
    {appointments.isLoading ? <LoadingState /> : appointments.isError ? <ErrorState error={appointments.error} retry={() => appointments.refetch()} /> : !appointments.data?.length ? <EmptyState title="Không có lịch hẹn phù hợp">Thử đổi ngày, chi nhánh hoặc trạng thái.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Mã lịch</th><th>Khách hàng</th><th>Thiết bị / dịch vụ</th><th>Đặt lúc</th><th>Trạng thái</th><th /></tr></thead><tbody>{appointments.data.map(item => <tr key={item.appointment.id}><td><strong>#{item.appointment.id}</strong></td><td><strong>{item.appointment.customerFullName}</strong><small>{item.appointment.customerPhone}</small></td><td><strong>{item.devices.length} thiết bị</strong><small>{item.devices.flatMap(device => device.serviceItems).map(service => service.serviceNameSnapshot).join(', ')}</small></td><td><time dateTime={item.appointment.bookedAt}>{formatDateTime(item.appointment.bookedAt)}</time></td><td><StatusBadge label={appointmentStatusLabels[item.appointment.status]} tone={appointmentStatusTones[item.appointment.status]} /></td><td><button className="button button--quiet" onClick={() => setSelected(item)}>{item.appointment.status === 'PENDING_CONFIRMATION' ? 'Xác nhận lịch' : item.appointment.status === 'CONFIRMED' ? 'Khách đã đến' : 'Xem chi tiết'}</button></td></tr>)}</tbody></table></div>}
    {selected && <AppointmentDrawer detail={selected} close={() => setSelected(undefined)} onUpdated={refresh} />}
  </div>
}

function AppointmentDrawer({ detail: initialDetail, close, onUpdated }: { detail: AppointmentDetailResponse; close: () => void; onUpdated: (detail: AppointmentDetailResponse) => Promise<void> }) {
  const detailQuery = useQuery({ queryKey: ['internal', 'appointment', initialDetail.appointment.id], queryFn: ({ signal }) => receptionistApi.appointment(initialDetail.appointment.id, signal) })
  const detail = detailQuery.data ?? initialDetail
  const appointment = detail.appointment
  const [cancelMode, setCancelMode] = useState(false)
  const [rescheduleMode, setRescheduleMode] = useState(false)
  const [reason, setReason] = useState('')
  const [newBranchId, setNewBranchId] = useState<number>()
  const [newDate, setNewDate] = useState('')
  const [newSlotId, setNewSlotId] = useState<number>()
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: rescheduleMode })
  const slots = useQuery({ queryKey: ['public', 'slots', newBranchId, newDate], queryFn: ({ signal }) => publicApi.slots(newBranchId!, newDate, signal), enabled: Boolean(rescheduleMode && newBranchId && newDate) })
  const action = useMutation({
    mutationFn: ({ kind }: { kind: 'confirm' | 'arrive' | 'expire' | 'cancel' | 'reschedule' }) => {
      if (kind === 'confirm') return receptionistApi.confirm(appointment.id)
      if (kind === 'arrive') return receptionistApi.arrive(appointment.id)
      if (kind === 'expire') return receptionistApi.expire(appointment.id)
      if (kind === 'reschedule') return receptionistApi.reschedule(appointment.id, newSlotId!)
      return receptionistApi.cancel(appointment.id, reason)
    },
    onSuccess: async updated => {
      setCancelMode(false)
      setRescheduleMode(false)
      await onUpdated(updated)
    },
  })
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="appointment-title"><header><div><span className="record-code">LỊCH #{appointment.id}</span><h2 id="appointment-title">Chi tiết lịch hẹn</h2></div><button onClick={close} aria-label="Đóng">×</button></header><div className="drawer-body"><div className="appointment-customer"><span>Khách đặt lịch</span><strong>{appointment.customerFullName}</strong><a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a></div>{detailQuery.isLoading && <LoadingState label="Đang tải chi tiết lịch hẹn…" />}<div className="detail-strip"><div><span>Trạng thái</span><StatusBadge label={appointmentStatusLabels[appointment.status]} tone={appointmentStatusTones[appointment.status]} /></div><div><span>{appointment.confirmedAt ? 'Xác nhận lúc' : 'Cập nhật gần nhất'}</span><strong>{formatDateTime(appointment.confirmedAt ?? appointment.updatedAt)}</strong></div><div><span>Đặt lúc</span><strong>{formatDateTime(appointment.bookedAt)}</strong></div><div><span>Ưu đãi đặt lịch trực tuyến</span><strong>{appointment.discountPercent}%</strong></div></div>{appointment.note && <div className="detail-note"><span>Ghi chú</span><p>{appointment.note}</p></div>}<h3>Thiết bị & dịch vụ</h3>{detail.devices.map((entry, index) => <article className="appointment-device" key={entry.device.id}><span>Thiết bị {index + 1} thuộc lịch #{appointment.id}</span>{entry.device.symptomDescription && <p>{entry.device.symptomDescription}</p>}<ul>{entry.serviceItems.map(service => <li key={service.id}><span>{service.serviceNameSnapshot}</span><strong>{formatMoney(service.finalPriceSnapshot)}</strong></li>)}</ul>{appointment.status === 'ARRIVED' && <Link className="button button--primary" to={`/internal/receptionist/intake?appointmentDeviceId=${entry.device.id}`}>Tiếp nhận thiết bị này</Link>}</article>)}{action.isError && <ErrorState error={action.error} />}{cancelMode && <label className="field"><span>Lý do hủy</span><textarea placeholder="Nhập lý do hủy lịch để lưu cùng lịch sử" value={reason} onChange={event => setReason(event.target.value)} maxLength={5000} autoFocus /></label>}{rescheduleMode && <div className="reschedule-box"><h3>Chọn khung giờ mới</h3><label className="field"><span>Chi nhánh</span><select value={newBranchId ?? ''} onChange={event => { setNewBranchId(Number(event.target.value) || undefined); setNewSlotId(undefined) }}><option value="">Chọn chi nhánh</option>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>Ngày</span><input type="date" value={newDate} onChange={event => { setNewDate(event.target.value); setNewSlotId(undefined) }} /></label>{slots.isLoading ? <LoadingState /> : <div className="slot-grid slot-grid--drawer">{slots.data?.map(slot => <button key={slot.slotId} disabled={slot.status === 'CLOSED'} className={newSlotId === slot.slotId ? 'selected' : ''} onClick={() => setNewSlotId(slot.slotId)}><strong>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</strong><span>{slot.activeBookingCount} lượt đã đặt</span></button>)}</div>}</div>}</div><footer>{appointment.status === 'PENDING_CONFIRMATION' && <button className="button button--primary" disabled={action.isPending} onClick={() => action.mutate({ kind: 'confirm' })}>Xác nhận lịch</button>}{appointment.status === 'CONFIRMED' && <button className="button button--primary" disabled={action.isPending} onClick={() => action.mutate({ kind: 'arrive' })}>Khách đã đến</button>}{(appointment.status === 'PENDING_CONFIRMATION' || appointment.status === 'CONFIRMED') && <button className="button button--quiet" disabled={action.isPending} onClick={() => { setRescheduleMode(value => !value); setCancelMode(false) }}>Đổi lịch</button>}{rescheduleMode && <button className="button button--secondary" disabled={!newSlotId || action.isPending} onClick={() => action.mutate({ kind: 'reschedule' })}>Lưu khung giờ mới</button>}{(appointment.status === 'PENDING_CONFIRMATION' || appointment.status === 'CONFIRMED') && <>{cancelMode ? <button className="button button--secondary" disabled={!reason.trim() || action.isPending} onClick={() => action.mutate({ kind: 'cancel' })}>Xác nhận hủy</button> : <button className="button button--quiet" disabled={action.isPending} onClick={() => { setCancelMode(true); setRescheduleMode(false) }}>Hủy lịch</button>}</>}{appointment.status === 'PENDING_CONFIRMATION' && <button className="button button--quiet" disabled={action.isPending} onClick={() => action.mutate({ kind: 'expire' })}>Đánh dấu hết hạn</button>}</footer></aside></div>
}
