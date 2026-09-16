import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { UserResponse, UserRole } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { useAuth } from '../../../auth/useAuth'
import { compareText } from '../../../utils/table'

const blank = { username: '', password: '', fullName: '', phone: '', role: 'RECEPTIONIST' as UserRole }
const roleLabels: Record<UserRole, string> = { ADMIN: 'Quản trị viên', RECEPTIONIST: 'Nhân viên tiếp nhận', TECHNICIAN: 'Kỹ thuật viên' }

export function UsersPage() {
  const client = useQueryClient()
  const { user: currentUser } = useAuth()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserResponse>()
  const [confirming, setConfirming] = useState<UserResponse>()
  const [form, setForm] = useState(blank)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState<string>()
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'users'] })
  const closeForm = () => { setEditing(undefined); setShowForm(false); setForm(blank); save.reset() }
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return adminApi.createUser({ ...form, phone: form.phone || undefined })
      const updated = await adminApi.updateUserProfile(editing.id, { fullName: form.fullName, phone: form.phone || undefined })
      return editing.role === form.role ? updated : adminApi.updateUserRole(editing.id, form.role)
    },
    onSuccess: async () => { closeForm(); setToast('Đã lưu thông tin tài khoản.'); await refresh() },
  })
  const status = useMutation({ mutationFn: (target: UserResponse) => adminApi.updateUserStatus(target.id, target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'), onSuccess: async (_, target) => { setConfirming(undefined); setToast(target.status === 'ACTIVE' ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt tài khoản.'); await refresh() } })
  function edit(target: UserResponse) { setEditing(target); setShowForm(true); setForm({ username: target.username, password: '', fullName: target.fullName, phone: target.phone ?? '', role: target.role }) }
  const columns: DataColumn<UserResponse>[] = [
    { key: 'username', label: 'Tài khoản', render: target => <div className="business-cell"><strong>{target.username}</strong><small>Mã #{target.id}</small></div> },
    { key: 'name', label: 'Họ tên', render: target => <div className="business-cell"><strong>{target.fullName}</strong><small>{target.phone || 'Chưa có số điện thoại'}</small></div> },
    { key: 'role', label: 'Vai trò', render: target => <div className="business-cell"><strong>{roleLabels[target.role]}</strong><small>{target.role}</small></div> },
    { key: 'status', label: 'Trạng thái', render: target => <StatusBadge label={target.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'} tone={target.status === 'ACTIVE' ? 'success' : 'warning'} /> },
    { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: target => <div className="row-actions"><button className="text-action" onClick={() => edit(target)}>Sửa</button><button className="text-action" disabled={status.isPending || target.id === currentUser?.id} title={target.id === currentUser?.id ? 'Không thể thay đổi trạng thái tài khoản đang đăng nhập' : undefined} onClick={() => target.status === 'ACTIVE' ? setConfirming(target) : status.mutate(target)}>{target.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></div> },
  ]
  const filters: TableFilter<UserResponse>[] = [
    { key: 'role', label: 'Vai trò', value: roleFilter, onChange: setRoleFilter, options: (Object.keys(roleLabels) as UserRole[]).map(value => ({ value, label: roleLabels[value] })), matches: (target, value) => target.role === value },
    { key: 'status', label: 'Trạng thái', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }], matches: (target, value) => target.status === value },
  ]

  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Nhân sự</span><h1>Tài khoản nội bộ</h1><p>Tìm kiếm và quản lý quyền truy cập của nhân viên theo vai trò, trạng thái.</p></div><button className="button button--primary" onClick={() => { setEditing(undefined); setForm(blank); setShowForm(true) }}>+ Thêm tài khoản</button></header>
    {users.isLoading ? <LoadingState /> : users.isError ? <ErrorState error={users.error} retry={() => users.refetch()} /> : <AdminDataTable rows={users.data ?? []} rowKey={target => target.id} columns={columns} filters={filters} searchPlaceholder="Tìm tên đăng nhập hoặc họ tên..." searchableText={target => `${target.username} ${target.fullName} ${target.phone ?? ''}`} sortOptions={[{ value: 'name-asc', label: 'Họ tên A–Z', compare: (a, b) => compareText(a.fullName, b.fullName) }, { value: 'username-asc', label: 'Tên đăng nhập A–Z', compare: (a, b) => compareText(a.username, b.username) }]} />}
    {showForm && <DetailDrawer eyebrow={editing ? 'Cập nhật tài khoản' : 'Tài khoản mới'} title={editing?.fullName ?? 'Thêm tài khoản nội bộ'} onClose={closeForm} footer={<><button className="button button--quiet" onClick={closeForm}>Hủy</button><button className="button button--primary" disabled={!form.username.trim() || !form.fullName.trim() || (!editing && form.password.length < 10) || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu tài khoản'}</button></>}><p className="drawer-lead">Mật khẩu chỉ được gửi khi tạo và không được hiển thị lại.</p><div className="form-grid drawer-form"><label className="field"><span>Tên đăng nhập</span><input autoComplete="username" disabled={Boolean(editing)} value={form.username} onChange={event => setForm(value => ({ ...value, username: event.target.value }))} /></label>{!editing && <label className="field"><span>Mật khẩu ban đầu</span><input type="password" minLength={10} maxLength={72} autoComplete="new-password" value={form.password} onChange={event => setForm(value => ({ ...value, password: event.target.value }))} /></label>}<label className="field"><span>Họ tên</span><input autoComplete="name" value={form.fullName} onChange={event => setForm(value => ({ ...value, fullName: event.target.value }))} /></label><label className="field"><span>Điện thoại <i>Không bắt buộc</i></span><input type="tel" autoComplete="tel" value={form.phone} onChange={event => setForm(value => ({ ...value, phone: event.target.value }))} /></label><label className="field"><span>Vai trò</span><select disabled={editing?.id === currentUser?.id} value={form.role} onChange={event => setForm(value => ({ ...value, role: event.target.value as UserRole }))}>{(Object.keys(roleLabels) as UserRole[]).map(role => <option value={role} key={role}>{roleLabels[role]} — {role}</option>)}</select></label></div>{save.isError && <ErrorState error={save.error} />}</DetailDrawer>}
    {confirming && <ConfirmDialog title={`${confirming.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'} tài khoản?`} confirmLabel={confirming.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'} busy={status.isPending} onCancel={() => setConfirming(undefined)} onConfirm={() => status.mutate(confirming)}><p>{confirming.status === 'ACTIVE' ? 'Tài khoản sẽ không thể đăng nhập cho tới khi được kích hoạt lại.' : 'Tài khoản sẽ có thể đăng nhập và sử dụng quyền được cấp.'}</p><strong>{confirming.fullName} · {confirming.username}</strong>{status.isError && <ErrorState error={status.error} />}</ConfirmDialog>}
    {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
  </div>
}
