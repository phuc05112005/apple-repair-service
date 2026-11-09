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
import { BulkTechnicianScheduleDrawer } from './BulkTechnicianScheduleDrawer'

type StaffRole = Extract<UserRole, 'RECEPTIONIST' | 'TECHNICIAN'>
type ViewMode = 'employee' | 'branch'

const today = () => businessDate()
const statusLabels: Record<TechnicianScheduleStatus, string> = { WORKING: 'Làm việc', OFF: 'Nghỉ', CANCELLED: 'Đã hủy' }
const roleLabels: Record<StaffRole, string> = { RECEPTIONIST: 'Nhân viên tiếp nhận', TECHNICIAN: 'Kỹ thuật viên' }

export function SchedulesPage() {
  const client = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('branch') // Mặc định mở luôn chế độ Theo chi nhánh
  const [role, setRole] = useState<StaffRole>('TECHNICIAN')
  const [employeeId, setEmployeeId] = useState<number>()
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [branchSearch, setBranchSearch] = useState('')
  const [date, setDate] = useState(today)
  const [selectedBranchId, setSelectedBranchId] = useState<number>()

  const [editing, setEditing] = useState<TechnicianScheduleResponse>()
  const [deleting, setDeleting] = useState<TechnicianScheduleResponse>()
  const [showForm, setShowForm] = useState(false)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [formEmployeeId, setFormEmployeeId] = useState<number>()
  const [branchId, setBranchId] = useState<number>()
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [shiftStatus, setShiftStatus] = useState<TechnicianScheduleStatus>('WORKING')
  const [toast, setToast] = useState<string>()

  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })

  const userMap = useMemo(() => new Map((users.data ?? []).map(user => [user.id, user])), [users.data])
  const branchNames = useMemo(() => new Map(branches.data?.map(branch => [branch.id, branch.name])), [branches.data])

  const activeBranchId = selectedBranchId ?? branches.data?.[0]?.id

  const employees = useMemo(() => (users.data ?? []).filter(user => user.role === role), [users.data, role])
  const visibleEmployees = employees.filter(user => `${user.fullName} ${user.username}`.toLocaleLowerCase('vi').includes(employeeSearch.toLocaleLowerCase('vi')))
  const selectedId = visibleEmployees.some(user => user.id === employeeId) ? employeeId : visibleEmployees[0]?.id
  const employee = employees.find(user => user.id === selectedId)

  const shifts = useQuery({
    queryKey: ['admin', 'schedules', selectedId, date],
    queryFn: ({ signal }) => adminApi.schedules(selectedId!, date, signal),
    enabled: viewMode === 'employee' && Boolean(selectedId && date)
  })

  const branchShifts = useQuery({
    queryKey: ['admin', 'schedules', 'branch', activeBranchId, date],
    queryFn: async ({ signal }) => {
      try {
        const allDateSchedules = await adminApi.schedules(undefined as unknown as number, date, signal)
        return allDateSchedules.filter(s => s.branchId === activeBranchId)
      } catch {
        const allStaff = users.data ?? []
        const results = await Promise.all(
          allStaff.map(u => adminApi.schedules(u.id, date, signal).catch(() => []))
        )
        return results.flat().filter(s => s.branchId === activeBranchId)
      }
    },
    enabled: viewMode === 'branch' && Boolean(activeBranchId && date && users.data)
  })

  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'schedules'] })

  const targetTechId = formEmployeeId ?? (viewMode === 'employee' ? selectedId : users.data?.[0]?.id)

  const save = useMutation({
    mutationFn: () => adminApi.saveSchedule(editing?.id, {
      technicianId: editing ? editing.technicianId : targetTechId!,
      branchId: branchId!,
      workDate: date,
      startTime,
      endTime,
      status: shiftStatus
    }),
    onSuccess: async () => {
      setShowForm(false)
      setEditing(undefined)
      setToast('Đã lưu ca làm.')
      await refresh()
    }
  })

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteSchedule(id),
    onSuccess: async () => {
      setDeleting(undefined)
      setToast('Đã xóa dữ liệu thành công.')
      await refresh()
    }
  })

  const employeeColumns: DataColumn<TechnicianScheduleResponse>[] = [
    { key: 'employee', label: 'Nhân viên', render: () => <strong>{employee?.fullName ?? '—'}</strong> },
    { key: 'branch', label: 'Chi nhánh', render: shift => branchNames.get(shift.branchId) ?? `#${shift.branchId}` },
    { key: 'date', label: 'Ngày', render: shift => formatDate(shift.workDate) },
    { key: 'time', label: 'Ca làm', render: shift => <strong>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</strong> },
    { key: 'status', label: 'Trạng thái', render: shift => <StatusBadge label={statusLabels[shift.status]} tone={shift.status === 'WORKING' ? 'success' : 'warning'} /> },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'table-actions-cell',
      render: shift => (
        <div className="row-actions">
          <button className="text-action" onClick={() => {
            setEditing(shift)
            setFormEmployeeId(shift.technicianId)
            setBranchId(shift.branchId)
            setStartTime(shift.startTime.slice(0, 5))
            setEndTime(shift.endTime.slice(0, 5))
            setShiftStatus(shift.status)
            setShowForm(true)
          }}>Sửa</button>
          <button className="text-action text-action--danger" onClick={() => setDeleting(shift)}>Xóa</button>
        </div>
      )
    },
  ]

  const branchColumns: DataColumn<TechnicianScheduleResponse>[] = [
    {
      key: 'employee',
      label: 'Nhân viên làm việc',
      render: shift => {
        const staff = userMap.get(shift.technicianId)
        return (
          <div>
            <strong>{staff?.fullName ?? `ID #${shift.technicianId}`}</strong>
            <small style={{ display: 'block', color: '#64748b' }}>{staff ? roleLabels[staff.role as StaffRole] ?? staff.role : '—'}</small>
          </div>
        )
      }
    },
    { key: 'role', label: 'Vai trò', render: shift => roleLabels[userMap.get(shift.technicianId)?.role as StaffRole] ?? '—' },
    { key: 'time', label: 'Ca làm việc', render: shift => <strong>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</strong> },
    { key: 'status', label: 'Trạng thái', render: shift => <StatusBadge label={statusLabels[shift.status]} tone={shift.status === 'WORKING' ? 'success' : 'warning'} /> },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'table-actions-cell',
      render: shift => (
        <div className="row-actions">
          <button className="text-action" onClick={() => {
            setEditing(shift)
            setFormEmployeeId(shift.technicianId)
            setBranchId(shift.branchId)
            setStartTime(shift.startTime.slice(0, 5))
            setEndTime(shift.endTime.slice(0, 5))
            setShiftStatus(shift.status)
            setShowForm(true)
          }}>Sửa</button>
          <button className="text-action text-action--danger" onClick={() => setDeleting(shift)}>Xóa</button>
        </div>
      )
    },
  ]

  const activeBranchName = branchNames.get(activeBranchId ?? 0) ?? 'Chi nhánh'

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Nhân sự</span>
          <h1>Quản lý lịch làm việc</h1>
          <p>Tra cứu lịch làm việc theo cá nhân hoặc xem danh sách nhân sự trực tại chi nhánh theo ngày.</p>
        </div>
        <div className="row-actions">
          <button
            className="button button--secondary"
            onClick={() => {
              setEditing(undefined)
              setFormEmployeeId(selectedId ?? users.data?.[0]?.id)
              setBranchId(activeBranchId)
              setStartTime('08:00')
              setEndTime('17:00')
              setShiftStatus('WORKING')
              setShowForm(true)
            }}
          >
            Thêm ca riêng lẻ
          </button>
          <button className="button button--primary" onClick={() => setShowBatchForm(true)}>
            + Xếp lịch nhiều KTV
          </button>
        </div>
      </header>

      <div className="context-filters">
        <label className="field">
          <span>Chế độ xem</span>
          <select value={viewMode} onChange={event => setViewMode(event.target.value as ViewMode)}>
            <option value="branch">Theo chi nhánh</option>
            <option value="employee">Theo nhân viên</option>
          </select>
        </label>

        {viewMode === 'employee' ? (
          <>
            <label className="field">
              <span>Vai trò nhân viên</span>
              <select value={role} onChange={event => { setRole(event.target.value as StaffRole); setEmployeeId(undefined); setEmployeeSearch('') }}>
                <option value="RECEPTIONIST">Nhân viên tiếp nhận</option>
                <option value="TECHNICIAN">Kỹ thuật viên</option>
              </select>
            </label>
            <label className="field">
              <span>Tìm nhân viên</span>
              <input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Nhập tên hoặc tài khoản nhân viên" />
            </label>
            <label className="field">
              <span>Nhân viên</span>
              <select value={visibleEmployees.some(user => user.id === selectedId) ? selectedId : ''} onChange={event => setEmployeeId(Number(event.target.value))}>
                <option value="">Chọn nhân viên</option>
                {visibleEmployees.map(user => (
                  <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Chi nhánh</span>
              <select value={activeBranchId ?? ''} onChange={event => setSelectedBranchId(Number(event.target.value))}>
                {branches.data?.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tìm trong ca làm</span>
              <input value={branchSearch} onChange={event => setBranchSearch(event.target.value)} placeholder="Nhập tên nhân viên hoặc ca làm" />
            </label>
          </>
        )}

        <label className="field">
          <span>Ngày</span>
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
      </div>

      {users.isLoading || branches.isLoading ? (
        <LoadingState />
      ) : users.isError || branches.isError ? (
        <ErrorState error={users.error ?? branches.error} retry={() => { users.refetch(); branches.refetch() }} />
      ) : viewMode === 'employee' ? (
        !selectedId ? (
          <p>Không tìm thấy nhân viên thuộc vai trò này.</p>
        ) : shifts.isLoading ? (
          <LoadingState />
        ) : shifts.isError ? (
          <ErrorState error={shifts.error} retry={() => shifts.refetch()} />
        ) : (
          <AdminDataTable
            rows={shifts.data ?? []}
            rowKey={shift => shift.id}
            columns={employeeColumns}
            searchPlaceholder="Nhập chi nhánh hoặc giờ làm"
            searchableText={shift => `${employee?.fullName ?? ''} ${branchNames.get(shift.branchId) ?? ''} ${shift.startTime} ${shift.endTime}`}
            emptyText="Chưa có lịch làm trong ngày đã chọn."
          />
        )
      ) : branchShifts.isLoading ? (
        <LoadingState />
      ) : branchShifts.isError ? (
        <ErrorState error={branchShifts.error} retry={() => branchShifts.refetch()} />
      ) : (
        <AdminDataTable
          rows={(branchShifts.data ?? []).filter(shift => {
            if (!branchSearch.trim()) return true
            const staff = userMap.get(shift.technicianId)
            const searchText = `${staff?.fullName ?? ''} ${staff?.username ?? ''} ${shift.startTime} ${shift.endTime}`.toLowerCase()
            return searchText.includes(branchSearch.trim().toLowerCase())
          })}
          rowKey={shift => shift.id}
          columns={branchColumns}
          searchPlaceholder="Lọc danh sách làm việc"
          searchableText={shift => {
            const staff = userMap.get(shift.technicianId)
            return `${staff?.fullName ?? ''} ${shift.startTime} ${shift.endTime}`
          }}
          emptyText={`Không có nhân viên nào xếp lịch làm việc tại ${activeBranchName} trong ngày ${formatDate(date)}.`}
        />
      )}

      {showForm && (
        <DetailDrawer
          eyebrow={editing ? 'Chỉnh sửa ca' : 'Ca làm mới'}
          title={editing ? userMap.get(editing.technicianId)?.fullName ?? 'Nhân viên' : 'Xếp ca làm việc'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="button button--quiet" onClick={() => setShowForm(false)}>Hủy</button>
              <button
                className="button button--primary"
                disabled={!targetTechId || !branchId || !startTime || !endTime || startTime >= endTime || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? 'Đang lưu…' : 'Lưu ca làm'}
              </button>
            </>
          }
        >
          <div className="form-grid drawer-form">
            {!editing && (
              <label className="field">
                <span>Nhân viên</span>
                <select value={formEmployeeId ?? targetTechId ?? ''} onChange={event => setFormEmployeeId(Number(event.target.value))}>
                  <option value="">Chọn nhân viên</option>
                  {users.data?.filter(u => u.status === 'ACTIVE' && (u.role === 'TECHNICIAN' || u.role === 'RECEPTIONIST')).map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({roleLabels[u.role as StaffRole] ?? u.role})</option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Chi nhánh</span>
              <select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value))}>
                <option value="">Chọn chi nhánh</option>
                {branches.data?.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bắt đầu</span>
              <input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} />
            </label>
            <label className="field">
              <span>Kết thúc</span>
              <input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} />
            </label>
            <label className="field">
              <span>Trạng thái ca</span>
              <select value={shiftStatus} onChange={event => setShiftStatus(event.target.value as TechnicianScheduleStatus)}>
                <option value="WORKING">Làm việc</option>
                <option value="OFF">Nghỉ</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </label>
          </div>
          {save.isError && <ErrorState error={save.error} />}
        </DetailDrawer>
      )}

      {showBatchForm && branches.data && users.data && (
        <BulkTechnicianScheduleDrawer
          date={date}
          branches={branches.data}
          users={users.data}
          onClose={() => setShowBatchForm(false)}
          onSaved={async () => {
            await client.invalidateQueries({ queryKey: ['admin', 'schedules'] })
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa ca làm?"
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting.id)}
        >
          <p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được sử dụng trong hệ thống.</p>
          <strong>{userMap.get(deleting.technicianId)?.fullName} · {formatTime(deleting.startTime)}–{formatTime(deleting.endTime)}</strong>
          {remove.isError && <ErrorState error={remove.error} />}
        </ConfirmDialog>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}