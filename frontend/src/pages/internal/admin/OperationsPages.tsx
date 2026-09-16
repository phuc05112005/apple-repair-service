import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { BranchInventoryResponse, SlotAvailabilityResponse, TechnicianScheduleResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { formatDate, formatMoney, formatTime } from '../../../utils/format'
import { compareText } from '../../../utils/table'

export function InventoryPage() {
  const client = useQueryClient()
  const [branchId, setBranchId] = useState<number>()
  const [partId, setPartId] = useState<number>()
  const [destinationBranchId, setDestinationBranchId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [toast, setToast] = useState<string>()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal) })
  const inventories = useQuery({ queryKey: ['admin', 'inventories'], queryFn: ({ signal }) => adminApi.inventories({}, signal) })
  const inventory = useQuery({ queryKey: ['admin', 'inventory', branchId, partId], queryFn: ({ signal }) => adminApi.inventory(branchId!, partId!, signal), enabled: Boolean(showAdjustment && branchId && partId), retry: false })
  const branchMap = useMemo(() => new Map(branches.data?.map(item => [item.id, item])), [branches.data])
  const partMap = useMemo(() => new Map(parts.data?.map(item => [item.id, item])), [parts.data])
  const brands = Array.from(new Set((parts.data ?? []).map(item => item.brand).filter((value): value is string => Boolean(value)))).sort(compareText)
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'inventories'] }), client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId, partId] })]) }
  const adjust = useMutation({ mutationFn: (direction: 'stock-in' | 'stock-out') => adminApi.adjustStock(direction, { branchId: branchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: async () => { setToast('Đã cập nhật số lượng tồn kho.'); setNote(''); await refresh() } })
  const transfer = useMutation({ mutationFn: () => adminApi.transferStock({ sourceBranchId: branchId!, destinationBranchId: destinationBranchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: async () => { setToast('Đã chuyển kho thành công.'); setNote(''); await refresh() } })
  const columns: DataColumn<BranchInventoryResponse>[] = [
    { key: 'branch', label: 'Chi nhánh', render: row => <strong>{branchMap.get(row.branchId)?.name ?? `#${row.branchId}`}</strong> },
    { key: 'part', label: 'Linh kiện', render: row => { const part = partMap.get(row.partId); return <div className="business-cell"><strong>{part?.name ?? `#${row.partId}`}</strong><small>{part?.partCode}</small></div> } },
    { key: 'brand', label: 'Hãng', render: row => partMap.get(row.partId)?.brand ?? 'Chưa xác định' },
    { key: 'variant', label: 'Phiên bản', render: row => partMap.get(row.partId)?.variant ?? 'Tiêu chuẩn' },
    { key: 'quantity', label: 'Số lượng', render: row => <strong className="quantity-cell">{row.quantity}</strong> },
    { key: 'updated', label: 'Cập nhật gần nhất', render: row => formatDate(row.updatedAt) },
    { key: 'status', label: 'Tình trạng', render: row => <StatusBadge label={row.quantity > 0 ? 'Còn hàng' : 'Hết hàng'} tone={row.quantity > 0 ? 'success' : 'warning'} /> },
    { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: row => <button className="text-action" onClick={() => { setBranchId(row.branchId); setPartId(row.partId); setDestinationBranchId(undefined); setShowAdjustment(true) }}>Điều chỉnh</button> },
  ]
  const filters: TableFilter<BranchInventoryResponse>[] = [
    { key: 'branch', label: 'Chi nhánh', value: branchFilter, onChange: setBranchFilter, options: (branches.data ?? []).map(item => ({ value: String(item.id), label: item.name })), matches: (row, value) => String(row.branchId) === value },
    { key: 'brand', label: 'Hãng', value: brandFilter, onChange: setBrandFilter, options: brands.map(value => ({ value, label: value })), matches: (row, value) => partMap.get(row.partId)?.brand === value },
    { key: 'stock', label: 'Tình trạng', value: stockFilter, onChange: setStockFilter, options: [{ value: 'available', label: 'Còn hàng' }, { value: 'empty', label: 'Hết hàng' }], matches: (row, value) => value === 'available' ? row.quantity > 0 : row.quantity === 0 },
  ]
  const totalQuantity = (inventories.data ?? []).reduce((sum, item) => sum + item.quantity, 0)

  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Linh kiện</span><h1>Tồn kho theo chi nhánh</h1><p>Theo dõi linh kiện, hãng, phiên bản và số lượng thực tế tại từng địa điểm.</p></div><button className="button button--primary" onClick={() => { setBranchId(undefined); setPartId(undefined); setShowAdjustment(true) }}>Điều chỉnh tồn kho</button></header>
    <div className="metric-strip"><div><span>Dòng tồn kho</span><strong>{inventories.data?.length ?? 0}</strong></div><div><span>Tổng số lượng</span><strong>{totalQuantity}</strong></div><div><span>Linh kiện có tồn</span><strong>{new Set((inventories.data ?? []).filter(item => item.quantity > 0).map(item => item.partId)).size}</strong></div></div>
    {inventories.isLoading || branches.isLoading || parts.isLoading ? <LoadingState /> : inventories.isError || branches.isError || parts.isError ? <ErrorState error={inventories.error ?? branches.error ?? parts.error} retry={() => { inventories.refetch(); branches.refetch(); parts.refetch() }} /> : <AdminDataTable rows={inventories.data ?? []} rowKey={row => row.id} columns={columns} filters={filters} searchPlaceholder="Tìm linh kiện, hãng hoặc phiên bản..." searchableText={row => { const part = partMap.get(row.partId); return `${branchMap.get(row.branchId)?.name ?? ''} ${part?.name ?? ''} ${part?.partCode ?? ''} ${part?.brand ?? ''} ${part?.variant ?? ''}` }} sortOptions={[{ value: 'part-asc', label: 'Linh kiện A–Z', compare: (a, b) => compareText(partMap.get(a.partId)?.name ?? '', partMap.get(b.partId)?.name ?? '') }, { value: 'quantity-desc', label: 'Số lượng giảm dần', compare: (a, b) => b.quantity - a.quantity }, { value: 'quantity-asc', label: 'Số lượng tăng dần', compare: (a, b) => a.quantity - b.quantity }]} />}
    {showAdjustment && <DetailDrawer eyebrow="Vận hành tồn kho" title="Nhập, xuất hoặc chuyển kho" onClose={() => setShowAdjustment(false)} footer={<button className="button button--quiet" onClick={() => setShowAdjustment(false)}>Đóng</button>}><div className="drawer-form"><Picker label="Chi nhánh" value={branchId} onChange={value => { setBranchId(value); setDestinationBranchId(undefined) }} options={branches.data} /><Picker label="Linh kiện" value={partId} onChange={setPartId} options={parts.data?.map(part => ({ ...part, name: `${part.name} · ${part.brand ?? 'Không hãng'} · ${part.variant ?? 'Tiêu chuẩn'} · ${formatMoney(part.salePrice)}` }))} />{inventory.isLoading ? <LoadingState /> : branchId && partId && <div className="inventory-current"><span>Tồn hiện tại</span><strong>{inventory.data?.quantity ?? 0}</strong></div>}<div className="form-grid"><label className="field"><span>Số lượng</span><input type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><label className="field"><span>Ghi chú <i>Không bắt buộc</i></span><input value={note} onChange={event => setNote(event.target.value)} /></label></div>{(inventory.isError || adjust.isError || transfer.isError) && <ErrorState error={adjust.error ?? transfer.error ?? inventory.error} />}<div className="button-row"><button className="button button--primary" disabled={!branchId || !partId || quantity < 1 || adjust.isPending} onClick={() => adjust.mutate('stock-in')}>Nhập kho</button><button className="button button--secondary" disabled={!branchId || !partId || quantity < 1 || adjust.isPending} onClick={() => adjust.mutate('stock-out')}>Xuất kho</button></div><section className="detail-section"><h3>Chuyển sang chi nhánh khác</h3><Picker label="Chi nhánh nhận" value={destinationBranchId} onChange={setDestinationBranchId} options={branches.data?.filter(branch => branch.id !== branchId)} /><button className="button button--secondary" disabled={!branchId || !destinationBranchId || !partId || quantity < 1 || transfer.isPending} onClick={() => transfer.mutate()}>Chuyển kho</button></section></div></DetailDrawer>}
    {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
  </div>
}

export function SlotsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState(today)
  const [editingId, setEditingId] = useState<number>()
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<SlotAvailabilityResponse>()
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState<string>()
  const client = useQueryClient()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const activeBranchId = branchId ?? branches.data?.[0]?.id
  const slots = useQuery({ queryKey: ['admin', 'slots', activeBranchId, date], queryFn: ({ signal }) => adminApi.slots(activeBranchId!, date, signal), enabled: Boolean(activeBranchId && date) })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'slots', activeBranchId, date] })
  const save = useMutation({ mutationFn: () => adminApi.saveSlot(editingId, { branchId: activeBranchId!, slotDate: date, startTime, endTime }), onSuccess: async () => { setEditingId(undefined); setShowForm(false); setToast('Đã lưu khung giờ.'); await refresh() } })
  const status = useMutation({ mutationFn: ({ id, open }: { id: number; open: boolean }) => adminApi.setSlotOpen(id, open), onSuccess: async () => { setToast('Đã cập nhật trạng thái khung giờ.'); await refresh() } })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSlot(id), onSuccess: async () => { setDeleting(undefined); setEditingId(undefined); setToast('Đã xóa dữ liệu thành công.'); await refresh() } })
  const branch = branches.data?.find(item => item.id === activeBranchId)
  const columns: DataColumn<SlotAvailabilityResponse>[] = [{ key: 'branch', label: 'Chi nhánh', render: () => branch?.name ?? '—' }, { key: 'time', label: 'Khung giờ', render: slot => <strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong> }, { key: 'date', label: 'Ngày', render: slot => formatDate(slot.slotDate) }, { key: 'bookings', label: 'Số lượt đã đặt', render: slot => slot.activeBookingCount }, { key: 'status', label: 'Trạng thái', render: slot => <StatusBadge label={slot.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'} tone={slot.status === 'OPEN' ? 'success' : 'warning'} /> }, { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: slot => <div className="row-actions"><button className="text-action" onClick={() => { setEditingId(slot.slotId); setStartTime(slot.startTime.slice(0, 5)); setEndTime(slot.endTime.slice(0, 5)); setShowForm(true) }}>Sửa</button><button className="text-action text-action--danger" onClick={() => setDeleting(slot)}>Xóa</button><button className="text-action" onClick={() => status.mutate({ id: slot.slotId, open: slot.status !== 'OPEN' })}>{slot.status === 'OPEN' ? 'Đóng' : 'Mở'}</button></div> }]
  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Vận hành</span><h1>Khung giờ lịch hẹn</h1><p>Lọc theo chi nhánh, ngày và theo dõi số lượt đã đặt thực tế.</p></div><button className="button button--primary" disabled={!activeBranchId} onClick={() => { setEditingId(undefined); setStartTime('09:00'); setEndTime('10:00'); setShowForm(true) }}>+ Thêm khung giờ</button></header><div className="context-filters"><Picker label="Chi nhánh" value={activeBranchId} onChange={setBranchId} options={branches.data} /><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>{slots.isLoading ? <LoadingState /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : <AdminDataTable rows={slots.data ?? []} rowKey={slot => slot.slotId} columns={columns} searchableText={slot => `${branch?.name ?? ''} ${slot.startTime} ${slot.endTime}`} searchPlaceholder="Tìm theo khung giờ..." filters={[{ key: 'status', label: 'Trạng thái', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'OPEN', label: 'Đang mở' }, { value: 'CLOSED', label: 'Đã đóng' }], matches: (slot, value) => slot.status === value }]} sortOptions={[{ value: 'time-asc', label: 'Giờ sớm nhất', compare: (a, b) => a.startTime.localeCompare(b.startTime) }, { value: 'time-desc', label: 'Giờ muộn nhất', compare: (a, b) => b.startTime.localeCompare(a.startTime) }]} emptyText="Chưa có khung giờ trong ngày đã chọn." />}{showForm && <DetailDrawer eyebrow={editingId ? 'Chỉnh sửa' : 'Khung giờ mới'} title={`${branch?.name ?? 'Chi nhánh'} · ${formatDate(date)}`} onClose={() => setShowForm(false)} footer={<><button className="button button--quiet" onClick={() => setShowForm(false)}>Hủy</button><button className="button button--primary" disabled={!activeBranchId || !startTime || !endTime || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu khung giờ'}</button></>}><div className="form-grid drawer-form"><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>{save.isError && <ErrorState error={save.error} />}</DetailDrawer>}{deleting && <ConfirmDialog title="Xóa khung giờ?" busy={remove.isPending} onCancel={() => setDeleting(undefined)} onConfirm={() => remove.mutate(deleting.slotId)}><p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được lịch hẹn nào sử dụng.</p><strong>{formatTime(deleting.startTime)} – {formatTime(deleting.endTime)}</strong>{remove.isError && <ErrorState error={remove.error} />}</ConfirmDialog>}{toast && <Toast message={toast} onClose={() => setToast(undefined)} />}</div>
}

export function SchedulesPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [technicianId, setTechnicianId] = useState<number>()
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [editing, setEditing] = useState<TechnicianScheduleResponse>()
  const [deleting, setDeleting] = useState<TechnicianScheduleResponse>()
  const [showForm, setShowForm] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState<string>()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const technicians = useMemo(() => (users.data ?? []).filter(user => user.role === 'TECHNICIAN' && user.status === 'ACTIVE'), [users.data])
  const activeTechnicianId = technicianId ?? technicians[0]?.id
  const schedules = useQuery({ queryKey: ['admin', 'schedules', activeTechnicianId, date], queryFn: ({ signal }) => adminApi.schedules(activeTechnicianId!, date, signal), enabled: Boolean(activeTechnicianId && date) })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'schedules', activeTechnicianId, date] })
  const save = useMutation({ mutationFn: () => adminApi.saveSchedule(editing?.id, { technicianId: activeTechnicianId!, branchId: branchId!, workDate: date, startTime, endTime, status: editing?.status ?? 'WORKING' }), onSuccess: async () => { setEditing(undefined); setShowForm(false); setToast('Đã lưu lịch kỹ thuật viên.'); await refresh() } })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSchedule(id), onSuccess: async () => { setDeleting(undefined); setEditing(undefined); setToast('Đã xóa dữ liệu thành công.'); await refresh() } })
  const branchMap = useMemo(() => new Map(branches.data?.map(item => [item.id, item.name])), [branches.data])
  const technician = technicians.find(item => item.id === activeTechnicianId)
  const columns: DataColumn<TechnicianScheduleResponse>[] = [{ key: 'technician', label: 'Kỹ thuật viên', render: () => <strong>{technician?.fullName ?? '—'}</strong> }, { key: 'branch', label: 'Chi nhánh', render: schedule => branchMap.get(schedule.branchId) ?? `#${schedule.branchId}` }, { key: 'date', label: 'Ngày', render: schedule => formatDate(schedule.workDate) }, { key: 'time', label: 'Ca làm', render: schedule => <strong>{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</strong> }, { key: 'status', label: 'Trạng thái', render: schedule => <StatusBadge label={schedule.status === 'WORKING' ? 'Làm việc' : 'Nghỉ'} tone={schedule.status === 'WORKING' ? 'success' : 'warning'} /> }, { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: schedule => <div className="row-actions"><button className="text-action" onClick={() => { setEditing(schedule); setBranchId(schedule.branchId); setStartTime(schedule.startTime.slice(0, 5)); setEndTime(schedule.endTime.slice(0, 5)); setShowForm(true) }}>Sửa</button><button className="text-action text-action--danger" onClick={() => setDeleting(schedule)}>Xóa</button></div> }]
  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Nhân sự</span><h1>Lịch kỹ thuật viên</h1><p>Tra cứu ca làm theo kỹ thuật viên, chi nhánh, ngày và trạng thái.</p></div><button className="button button--primary" disabled={!activeTechnicianId} onClick={() => { setEditing(undefined); setBranchId(branches.data?.[0]?.id); setStartTime('08:00'); setEndTime('17:00'); setShowForm(true) }}>+ Thêm ca làm</button></header><div className="context-filters"><Picker label="Kỹ thuật viên" value={activeTechnicianId} onChange={setTechnicianId} options={technicians.map(item => ({ id: item.id, name: item.fullName }))} /><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>{schedules.isLoading ? <LoadingState /> : schedules.isError ? <ErrorState error={schedules.error} retry={() => schedules.refetch()} /> : <AdminDataTable rows={schedules.data ?? []} rowKey={schedule => schedule.id} columns={columns} searchPlaceholder="Tìm kỹ thuật viên hoặc chi nhánh..." searchableText={schedule => `${technician?.fullName ?? ''} ${branchMap.get(schedule.branchId) ?? ''} ${schedule.startTime} ${schedule.endTime}`} filters={[{ key: 'branch', label: 'Chi nhánh', value: branchFilter, onChange: setBranchFilter, options: (branches.data ?? []).map(item => ({ value: String(item.id), label: item.name })), matches: (schedule, value) => String(schedule.branchId) === value }, { key: 'status', label: 'Trạng thái', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'WORKING', label: 'Làm việc' }, { value: 'OFF', label: 'Nghỉ' }], matches: (schedule, value) => schedule.status === value }]} sortOptions={[{ value: 'time-asc', label: 'Giờ bắt đầu tăng dần', compare: (a, b) => a.startTime.localeCompare(b.startTime) }, { value: 'branch-asc', label: 'Chi nhánh A–Z', compare: (a, b) => compareText(branchMap.get(a.branchId) ?? '', branchMap.get(b.branchId) ?? '') }]} emptyText="Chưa có lịch làm trong ngày đã chọn." />}{showForm && <DetailDrawer eyebrow={editing ? 'Chỉnh sửa ca' : 'Ca làm mới'} title={technician?.fullName ?? 'Kỹ thuật viên'} onClose={() => setShowForm(false)} footer={<><button className="button button--quiet" onClick={() => setShowForm(false)}>Hủy</button><button className="button button--primary" disabled={!activeTechnicianId || !branchId || !startTime || !endTime || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu ca làm'}</button></>}><div className="form-grid drawer-form"><Picker label="Chi nhánh" value={branchId} onChange={setBranchId} options={branches.data} /><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>{save.isError && <ErrorState error={save.error} />}</DetailDrawer>}{deleting && <ConfirmDialog title="Xóa lịch kỹ thuật viên?" busy={remove.isPending} onCancel={() => setDeleting(undefined)} onConfirm={() => remove.mutate(deleting.id)}><p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được sử dụng trong hệ thống.</p><strong>{technician?.fullName} · {formatTime(deleting.startTime)}–{formatTime(deleting.endTime)}</strong>{remove.isError && <ErrorState error={remove.error} />}</ConfirmDialog>}{toast && <Toast message={toast} onClose={() => setToast(undefined)} />}</div>
}

function Picker<T extends { id: number; name: string }>({ label, value, onChange, options }: { label: string; value?: number; onChange: (value: number) => void; options?: T[] }) {
  return <label className="field"><span>{label}</span><select value={value ?? ''} onChange={event => onChange(Number(event.target.value))}><option value="">Chọn {label.toLowerCase()}</option>{options?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}
