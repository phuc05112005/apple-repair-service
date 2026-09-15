import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { TechnicianScheduleResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { formatTime } from '../../../utils/format'

export function InventoryPage() {
  const [branchId, setBranchId] = useState<number>()
  const [partId, setPartId] = useState<number>()
  const [destinationBranchId, setDestinationBranchId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const client = useQueryClient()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal) })
  const inventory = useQuery({ queryKey: ['admin', 'inventory', branchId, partId], queryFn: ({ signal }) => adminApi.inventory(branchId!, partId!, signal), enabled: Boolean(branchId && partId), retry: false })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId, partId] })
  const adjust = useMutation({ mutationFn: (direction: 'stock-in' | 'stock-out') => adminApi.adjustStock(direction, { branchId: branchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: refresh })
  const transfer = useMutation({ mutationFn: () => adminApi.transferStock({ sourceBranchId: branchId!, destinationBranchId: destinationBranchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: refresh })
  return <div className="workspace-page"><header><span className="eyebrow">Vận hành chi nhánh</span><h1>Tồn kho linh kiện</h1><p>Tra cứu một cặp chi nhánh–linh kiện trước khi nhập, xuất hoặc chuyển kho.</p></header><section className="form-panel"><div className="form-grid"><Picker label="Chi nhánh" value={branchId} onChange={setBranchId} options={branches.data} /><Picker label="Linh kiện" value={partId} onChange={setPartId} options={parts.data} /><label className="field"><span>Số lượng</span><input type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><label className="field"><span>Ghi chú</span><input value={note} onChange={event => setNote(event.target.value)} /></label></div>{inventory.isLoading ? <LoadingState /> : inventory.data ? <div className="service-summary"><div><span>Tồn hiện tại</span><strong>{inventory.data.quantity}</strong></div><div><span>Branch ID</span><strong>{inventory.data.branchId}</strong></div><div><span>Part ID</span><strong>{inventory.data.partId}</strong></div></div> : null}{(inventory.isError || adjust.isError || transfer.isError) && <ErrorState error={adjust.error ?? transfer.error ?? inventory.error} />}<div className="button-row"><button className="button button--primary" disabled={!branchId || !partId || adjust.isPending} onClick={() => adjust.mutate('stock-in')}>Nhập kho</button><button className="button button--secondary" disabled={!branchId || !partId || adjust.isPending} onClick={() => adjust.mutate('stock-out')}>Xuất kho</button></div><div className="form-grid"><Picker label="Chi nhánh nhận" value={destinationBranchId} onChange={setDestinationBranchId} options={branches.data?.filter(branch => branch.id !== branchId)} /><button className="button button--secondary" disabled={!branchId || !destinationBranchId || !partId || transfer.isPending} onClick={() => transfer.mutate()}>Chuyển kho</button></div></section></div>
}

export function SlotsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState(today)
  const [editingId, setEditingId] = useState<number>()
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const client = useQueryClient()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const slots = useQuery({ queryKey: ['admin', 'slots', branchId, date], queryFn: ({ signal }) => adminApi.slots(branchId!, date, signal), enabled: Boolean(branchId && date) })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'slots', branchId, date] })
  const save = useMutation({ mutationFn: () => adminApi.saveSlot(editingId, { branchId: branchId!, slotDate: date, startTime, endTime }), onSuccess: async () => { setEditingId(undefined); await refresh() } })
  const status = useMutation({ mutationFn: ({ id, open }: { id: number; open: boolean }) => adminApi.setSlotOpen(id, open), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSlot(id), onSuccess: async (_, id) => { if (editingId === id) setEditingId(undefined); await refresh() } })
  function confirmDelete(id: number) { if (window.confirm('Bạn có chắc muốn xóa dữ liệu này?')) remove.mutate(id) }
  return <div className="workspace-page"><header><span className="eyebrow">Vận hành chi nhánh</span><h1>Khung giờ lịch hẹn</h1><p>Cấu hình khung giờ và đóng/mở theo ngày tại từng chi nhánh.</p></header><section className="form-panel"><div className="form-grid"><Picker label="Chi nhánh" value={branchId} onChange={setBranchId} options={branches.data} /><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>{save.isError && <ErrorState error={save.error} />}<button className="button button--primary" disabled={!branchId || save.isPending} onClick={() => save.mutate()}>{editingId ? 'Cập nhật khung giờ' : 'Thêm khung giờ'}</button></section>{remove.isError && <ErrorState error={remove.error} />}{slots.isLoading ? <LoadingState /> : !slots.data?.length ? <EmptyState title="Chưa có khung giờ" /> : <div className="appointment-list">{slots.data.map(slot => <article key={slot.slotId}><div><span className="record-code">#{slot.slotId}</span><h3>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</h3><p>{slot.activeBookingCount} lượt đã đặt</p></div><div><StatusBadge label={slot.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'} tone={slot.status === 'OPEN' ? 'success' : 'warning'} /><button className="button button--secondary" onClick={() => { setEditingId(slot.slotId); setStartTime(slot.startTime.slice(0, 5)); setEndTime(slot.endTime.slice(0, 5)) }}>Sửa</button><button className="button button--danger" disabled={remove.isPending} onClick={() => confirmDelete(slot.slotId)}>Xóa</button><button className="button button--quiet" onClick={() => status.mutate({ id: slot.slotId, open: slot.status !== 'OPEN' })}>{slot.status === 'OPEN' ? 'Đóng' : 'Mở'}</button></div></article>)}</div>}</div>
}

export function SchedulesPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [technicianId, setTechnicianId] = useState<number>()
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [editing, setEditing] = useState<TechnicianScheduleResponse>()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const schedules = useQuery({ queryKey: ['admin', 'schedules', technicianId, date], queryFn: ({ signal }) => adminApi.schedules(technicianId!, date, signal), enabled: Boolean(technicianId && date) })
  const save = useMutation({ mutationFn: () => adminApi.saveSchedule(editing?.id, { technicianId: technicianId!, branchId: branchId!, workDate: date, startTime, endTime, status: 'WORKING' }), onSuccess: async () => { setEditing(undefined); await client.invalidateQueries({ queryKey: ['admin', 'schedules', technicianId, date] }) } })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSchedule(id), onSuccess: async (_, id) => { if (editing?.id === id) setEditing(undefined); await client.invalidateQueries({ queryKey: ['admin', 'schedules', technicianId, date] }) } })
  function confirmDelete(id: number) { if (window.confirm('Bạn có chắc muốn xóa dữ liệu này?')) remove.mutate(id) }
  const technicians = users.data?.filter(user => user.role === 'TECHNICIAN' && user.status === 'ACTIVE').map(user => ({ id: user.id, name: user.fullName }))
  return <div className="workspace-page"><header><span className="eyebrow">Vận hành chi nhánh</span><h1>Lịch kỹ thuật viên</h1><p>Xem và cấu hình ca làm theo kỹ thuật viên, ngày và chi nhánh.</p></header><section className="form-panel"><div className="form-grid"><Picker label="Kỹ thuật viên" value={technicianId} onChange={setTechnicianId} options={technicians} /><Picker label="Chi nhánh" value={branchId} onChange={setBranchId} options={branches.data} /><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>{save.isError && <ErrorState error={save.error} />}<button className="button button--primary" disabled={!technicianId || !branchId || save.isPending} onClick={() => save.mutate()}>{editing ? 'Cập nhật ca' : 'Thêm ca làm'}</button></section>{remove.isError && <ErrorState error={remove.error} />}{schedules.isLoading ? <LoadingState /> : !schedules.data?.length ? <EmptyState title="Chưa có ca làm" /> : <div className="appointment-list">{schedules.data.map(schedule => <article key={schedule.id}><div><span className="record-code">CA #{schedule.id}</span><h3>{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</h3><p>Branch #{schedule.branchId} · {schedule.status}</p></div><div><button className="button button--secondary" onClick={() => { setEditing(schedule); setBranchId(schedule.branchId); setStartTime(schedule.startTime.slice(0, 5)); setEndTime(schedule.endTime.slice(0, 5)) }}>Sửa</button><button className="button button--danger" disabled={remove.isPending} onClick={() => confirmDelete(schedule.id)}>Xóa</button></div></article>)}</div>}</div>
}

function Picker<T extends { id: number; name: string }>({ label, value, onChange, options }: { label: string; value?: number; onChange: (value?: number) => void; options?: T[] }) {
  return <label className="field"><span>{label}</span><select value={value ?? ''} onChange={event => onChange(Number(event.target.value) || undefined)}><option value="">Chọn {label.toLowerCase()}</option>{options?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
}
