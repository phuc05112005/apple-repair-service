import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TechnicianScheduleResponse, TechnicianScheduleStatus, UserRole } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { businessDate, formatDate, formatTime } from '../../../utils/format'

type StaffRole = Extract<UserRole, 'RECEPTIONIST' | 'TECHNICIAN'>
const today = () => businessDate()
const statusLabels: Record<TechnicianScheduleStatus, string> = { WORKING: 'Làm việc', OFF: 'Nghỉ', CANCELLED: 'Đã hủy' }

export function SchedulesPage() {
  const client = useQueryClient()
  const [role, setRole] = useState<StaffRole>('RECEPTIONIST')
  const [employeeId, setEmployeeId] = useState<number>()
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<TechnicianScheduleResponse>()
  const [deleting, setDeleting] = useState<TechnicianScheduleResponse>()
  const [showForm, setShowForm] = useState(false)
  const [branchId, setBranchId] = useState<number>()
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [shiftStatus, setShiftStatus] = useState<TechnicianScheduleStatus>('WORKING')
  const [toast, setToast] = useState<string>()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const employees = useMemo(() => (users.data ?? []).filter(user => user.role === role), [users.data, role])
  const visibleEmployees = employees.filter(user => `${user.fullName} ${user.username}`.toLocaleLowerCase('vi').includes(employeeSearch.toLocaleLowerCase('vi')))
  const selectedId = visibleEmployees.some(user => user.id === employeeId) ? employeeId : visibleEmployees[0]?.id
  const employee = employees.find(user => user.id === selectedId)
  const shifts = useQuery({ queryKey: ['admin', 'schedules', selectedId, date], queryFn: ({ signal }) => adminApi.schedules(selectedId!, date, signal), enabled: Boolean(selectedId && date) })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'schedules', selectedId, date] })
  const save = useMutation({ mutationFn: () => adminApi.saveSchedule(editing?.id, { technicianId: selectedId!, branchId: branchId!, workDate: date, startTime, endTime, status: shiftStatus }), onSuccess: async () => { setShowForm(false); setEditing(undefined); setToast('Đã lưu ca làm.'); await refresh() } })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSchedule(id), onSuccess: async () => { setDeleting(undefined); setToast('Đã xóa dữ liệu thành công.'); await refresh() } })
  const branchNames = useMemo(() => new Map(branches.data?.map(branch => [branch.id, branch.name])), [branches.data])
  const columns: DataColumn<TechnicianScheduleResponse>[] = [
    { key: 'employee', label: 'Nhân viên', render: () => <strong>{employee?.fullName ?? '—'}</strong> },
    { key: 'branch', label: 'Chi nhánh', render: shift => branchNames.get(shift.branchId) ?? `#${shift.branchId}` },
    { key: 'date', label: 'Ngày', render: shift => formatDate(shift.workDate) },
    { key: 'time', label: 'Ca làm', render: shift => <strong>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</strong> },
    { key: 'status', label: 'Trạng thái', render: shift => <StatusBadge label={statusLabels[shift.status]} tone={shift.status === 'WORKING' ? 'success' : 'warning'} /> },
    { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: shift => <div className="row-actions"><button className="text-action" onClick={() => { setEditing(shift); setBranchId(shift.branchId); setStartTime(shift.startTime.slice(0, 5)); setEndTime(shift.endTime.slice(0, 5)); setShiftStatus(shift.status); setShowForm(true) }}>Sửa</button><button className="text-action text-action--danger" onClick={() => setDeleting(shift)}>Xóa</button></div> },
  ]
  return <div className="workspace-page admin-resource-page">
    <header className="admin-page-header"><div><span className="eyebrow">Nhân sự</span><h1>Quản lý lịch làm việc</h1><p>Theo dõi và quản lý ca làm của nhân viên theo chi nhánh, ngày và trạng thái.</p></div><button className="button button--primary" disabled={!selectedId || employee?.status !== 'ACTIVE'} onClick={() => { setEditing(undefined); setBranchId(branches.data?.[0]?.id); setStartTime('08:00'); setEndTime('17:00'); setShiftStatus('WORKING'); setShowForm(true) }}>+ Thêm ca làm</button></header>
    <div className="context-filters"><label className="field"><span>Vai trò nhân viên</span><select value={role} onChange={event => { setRole(event.target.value as StaffRole); setEmployeeId(undefined); setEmployeeSearch('') }}><option value="RECEPTIONIST">Nhân viên tiếp nhận</option><option value="TECHNICIAN">Kỹ thuật viên</option></select></label><label className="field"><span>Tìm nhân viên</span><input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Nhập tên hoặc tài khoản nhân viên" /></label><label className="field"><span>Nhân viên</span><select value={visibleEmployees.some(user => user.id === selectedId) ? selectedId : ''} onChange={event => setEmployeeId(Number(event.target.value))}><option value="">Chọn nhân viên</option>{visibleEmployees.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}</select></label><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    {users.isLoading || branches.isLoading ? <LoadingState /> : users.isError || branches.isError ? <ErrorState error={users.error ?? branches.error} retry={() => { users.refetch(); branches.refetch() }} /> : !selectedId ? <p>Không tìm thấy nhân viên thuộc vai trò này.</p> : shifts.isLoading ? <LoadingState /> : shifts.isError ? <ErrorState error={shifts.error} retry={() => shifts.refetch()} /> : <AdminDataTable rows={shifts.data ?? []} rowKey={shift => shift.id} columns={columns} searchPlaceholder="Nhập chi nhánh hoặc giờ làm" searchableText={shift => `${employee?.fullName ?? ''} ${branchNames.get(shift.branchId) ?? ''} ${shift.startTime} ${shift.endTime}`} emptyText="Chưa có lịch làm trong ngày đã chọn." />}
    {showForm && <DetailDrawer eyebrow={editing ? 'Chỉnh sửa ca' : 'Ca làm mới'} title={employee?.fullName ?? 'Nhân viên'} onClose={() => setShowForm(false)} footer={<><button className="button button--quiet" onClick={() => setShowForm(false)}>Hủy</button><button className="button button--primary" disabled={!selectedId || employee?.status !== 'ACTIVE' || !branchId || !startTime || !endTime || startTime >= endTime || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu ca làm'}</button></>}><div className="form-grid drawer-form"><label className="field"><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value))}><option value="">Chọn chi nhánh</option>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label><label className="field"><span>Trạng thái ca</span><select value={shiftStatus} onChange={event => setShiftStatus(event.target.value as TechnicianScheduleStatus)}><option value="WORKING">Làm việc</option><option value="OFF">Nghỉ</option><option value="CANCELLED">Đã hủy</option></select></label></div>{save.isError && <ErrorState error={save.error} />}</DetailDrawer>}
    {deleting && <ConfirmDialog title="Xóa ca làm?" busy={remove.isPending} onCancel={() => setDeleting(undefined)} onConfirm={() => remove.mutate(deleting.id)}><p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được sử dụng trong hệ thống.</p><strong>{employee?.fullName} · {formatTime(deleting.startTime)}–{formatTime(deleting.endTime)}</strong>{remove.isError && <ErrorState error={remove.error} />}</ConfirmDialog>}
    {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
  </div>
}
