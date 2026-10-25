import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { UserResponse, UserRole, UserStatus } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { ApiError } from '../../../api/client'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { useAuth } from '../../../auth/useAuth'
import { compareText } from '../../../utils/table'

const blank = {
  username: '',
  password: '',
  fullName: '',
  phone: '',
  email: '',
  role: 'RECEPTIONIST' as UserRole,
  status: 'ACTIVE' as UserStatus,
}

const passwordBytes = (value: string) => new TextEncoder().encode(value).length

const errorMessage = (error: Error | null) =>
  error instanceof ApiError && error.fieldErrors.length
    ? error.fieldErrors.map(field => field.message).join('; ')
    : error?.message ?? 'Không thể hoàn tất thao tác. Vui lòng thử lại.'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Nhân viên tiếp nhận',
  TECHNICIAN: 'Kỹ thuật viên',
}

export function UsersPage() {
  const client = useQueryClient()
  const { user: currentUser } = useAuth()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserResponse>()
  const [confirming, setConfirming] = useState<UserResponse>()
  const [resetting, setResetting] = useState<UserResponse>()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string>()
  const [resetError, setResetError] = useState<string>()
  const [form, setForm] = useState(blank)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState<string>()

  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'users'] })
  const closeForm = () => { setEditing(undefined); setShowForm(false); setForm(blank); setFormError(undefined); save.reset() }
  const closeReset = () => { setResetting(undefined); setNewPassword(''); setConfirmPassword(''); setResetError(undefined); resetPassword.reset() }

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) {
        return adminApi.createUser({
          ...form,
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
        })
      }
      const updated = await adminApi.updateUserProfile(editing.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      })
      return editing.role === form.role ? updated : adminApi.updateUserRole(editing.id, form.role)
    },
    onSuccess: async () => { closeForm(); setToast('Đã lưu thông tin tài khoản.'); await refresh() },
  })

  const status = useMutation({
    mutationFn: (target: UserResponse) => adminApi.updateUserStatus(target.id, target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: async (_, target) => { setConfirming(undefined); setToast(target.status === 'ACTIVE' ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt tài khoản.'); await refresh() },
  })

  const resetPassword = useMutation({
    mutationFn: () => adminApi.resetUserPassword(resetting!.id, newPassword),
    onSuccess: () => { closeReset(); setToast('Đã cấp mật khẩu mới. Nhân viên cần đăng nhập lại.') },
  })

  function submitForm() {
    const errors: string[] = []
    if (!form.username.trim() || !form.fullName.trim()) errors.push('Vui lòng nhập tên đăng nhập và họ tên.')
    else if (!editing && form.username.trim().length < 3) errors.push('Tên đăng nhập cần ít nhất 3 ký tự.')
    if (!editing && users.data?.some(user => user.username.toLocaleLowerCase() === form.username.trim().toLocaleLowerCase())) errors.push('Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.')
    if (!editing && (form.password.length < 6 || form.password.length > 72 || passwordBytes(form.password) > 72)) errors.push('Mật khẩu cần từ 6 đến 72 ký tự và không quá 72 byte UTF-8.')
    
    const error = errors.join(' ') || undefined
    setFormError(error)
    if (!error) save.mutate()
  }

  function submitReset() {
    let error: string | undefined
    if (newPassword.length < 6 || newPassword.length > 72 || passwordBytes(newPassword) > 72) error = 'Mật khẩu mới cần từ 6 đến 72 ký tự và không quá 72 byte UTF-8.'
    else if (newPassword !== confirmPassword) error = 'Hai lần nhập mật khẩu chưa khớp.'
    setResetError(error)
    if (!error) resetPassword.mutate()
  }

  function edit(target: UserResponse) {
    setEditing(target)
    setShowForm(true)
    setFormError(undefined)
    setForm({
      username: target.username,
      password: '',
      fullName: target.fullName,
      phone: target.phone ?? '',
      email: target.email ?? '',
      role: target.role,
      status: target.status,
    })
  }

  const columns: DataColumn<UserResponse>[] = [
    {
      key: 'username',
      label: 'Tài khoản',
      render: target => (
        <div className="business-cell">
          <strong>{target.username}</strong>
          <small>Mã #{target.id}</small>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Họ tên & Liên hệ',
      render: target => (
        <div className="business-cell">
          <strong>{target.fullName}</strong>
          <small>{[target.phone, target.email].filter(Boolean).join(' • ') || 'Chưa cập nhật liên hệ'}</small>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Vai trò',
      render: target => (
        <div className="business-cell">
          <strong>{roleLabels[target.role]}</strong>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: target => (
        <StatusBadge
          label={target.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}
          tone={target.status === 'ACTIVE' ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'table-actions-cell',
      render: target => (
        <div className="row-actions">
          <button className="text-action" onClick={() => edit(target)}>Chi tiết & Chỉnh sửa</button>
          <button className="text-action" onClick={() => { setResetting(target); setResetError(undefined) }}>Cấp mật khẩu mới</button>
          <button
            className="text-action"
            disabled={status.isPending || target.id === currentUser?.id}
            title={target.id === currentUser?.id ? 'Không thể thay đổi trạng thái tài khoản đang đăng nhập' : undefined}
            onClick={() => target.status === 'ACTIVE' ? setConfirming(target) : status.mutate(target)}
          >
            {target.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </button>
        </div>
      ),
    },
  ]

  const filters: TableFilter<UserResponse>[] = [
    { key: 'role', label: 'Vai trò', value: roleFilter, onChange: setRoleFilter, options: (Object.keys(roleLabels) as UserRole[]).map(value => ({ value, label: roleLabels[value] })), matches: (target, value) => target.role === value },
    { key: 'status', label: 'Trạng thái', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }], matches: (target, value) => target.status === value },
  ]

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Nhân sự</span>
          <h1>Quản lý tài khoản</h1>
          <p>Tài khoản sử dụng trong hệ thống và kiểm soát quyền truy cập theo từng vai trò.</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => { setEditing(undefined); setForm(blank); setFormError(undefined); setShowForm(true) }}
        >
          + Thêm tài khoản
        </button>
      </header>

      {users.isLoading ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState error={users.error} retry={() => users.refetch()} />
      ) : (
        <AdminDataTable
          rows={users.data ?? []}
          rowKey={target => target.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Nhập tên đăng nhập, họ tên hoặc email"
          searchableText={target => `${target.username} ${target.fullName} ${target.phone ?? ''} ${target.email ?? ''}`}
          sortOptions={[
            { value: 'name-asc', label: 'Họ tên A–Z', compare: (a, b) => compareText(a.fullName, b.fullName) },
            { value: 'username-asc', label: 'Tên đăng nhập A–Z', compare: (a, b) => compareText(a.username, b.username) },
          ]}
        />
      )}

      {showForm && (
        <DetailDrawer
          eyebrow={editing ? 'Cập nhật tài khoản' : 'Tài khoản mới'}
          title={editing?.fullName ?? 'Thêm tài khoản nội bộ'}
          onClose={closeForm}
          footer={
            <>
              <button className="button button--quiet" onClick={closeForm}>Hủy</button>
              <button className="button button--primary" disabled={save.isPending} onClick={submitForm}>
                {save.isPending ? 'Đang lưu…' : 'Lưu tài khoản'}
              </button>
            </>
          }
        >
          {!editing && (
            <p className="drawer-lead">
              Mật khẩu chỉ được gửi khi tạo và không được hiển thị lại.
            </p>
          )}

          <div className="form-grid drawer-form" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="field">
              <label className="field-label">
                <b>Tên đăng nhập <span style={{ color: 'var(--red)' }}>*</span></b>
              </label>
              <input
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                disabled={!!editing}
                value={form.username}
                onChange={event => setForm(value => ({ ...value, username: event.target.value }))}
                style={editing ? { opacity: 0.65, cursor: 'not-allowed', background: '#f4f4f1' } : {}}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <b>Họ tên <span style={{ color: 'var(--red)' }}>*</span></b>
              </label>
              <input
                placeholder="Nhập họ tên nhân viên"
                autoComplete="name"
                value={form.fullName}
                onChange={event => setForm(value => ({ ...value, fullName: event.target.value }))}
              />
            </div>

            {!editing && (
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label className="field-label">
                  <b>Mật khẩu ban đầu <span style={{ color: 'var(--red)' }}>*</span></b>
                </label>
                <input
                  placeholder="Nhập mật khẩu khởi tạo"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={72}
                  value={form.password}
                  onChange={event => setForm(value => ({ ...value, password: event.target.value }))}
                />
                <small className="field-help">Từ 6 đến 72 ký tự (tối đa 72 byte UTF-8).</small>
              </div>
            )}

            <div className="field">
              <label className="field-label">
                <b>Số điện thoại</b>
              </label>
              <input
                placeholder="0901234567"
                type="tel"
                value={form.phone}
                onChange={event => setForm(value => ({ ...value, phone: event.target.value }))}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <b>Email liên hệ</b>
              </label>
              <input
                placeholder="nhanvien@taocare.vn"
                type="email"
                value={form.email}
                onChange={event => setForm(value => ({ ...value, email: event.target.value }))}
              />
            </div>

            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label className="field-label">
                <b>Vai trò hệ thống <span style={{ color: 'var(--red)' }}>*</span></b>
              </label>
              <select
                value={form.role}
                onChange={event => setForm(value => ({ ...value, role: event.target.value as UserRole }))}
              >
                <option value="RECEPTIONIST">Nhân viên tiếp nhận</option>
                <option value="TECHNICIAN">Kỹ thuật viên</option>
                <option value="ADMIN">Quản trị viên</option>
              </select>
            </div>
          </div>

          {(formError || save.isError) && (
            <div className="dialog-error" role="alert" style={{ marginTop: '1rem' }}>
              {formError ?? errorMessage(save.error)}
            </div>
          )}
        </DetailDrawer>
      )}

      {resetting && (
        <DetailDrawer
          eyebrow="Bảo mật"
          title={`Đổi mật khẩu cho ${resetting.username}`}
          onClose={closeReset}
          footer={
            <>
              <button className="button button--quiet" onClick={closeReset}>Hủy</button>
              <button className="button button--primary" disabled={resetPassword.isPending} onClick={submitReset}>
                {resetPassword.isPending ? 'Đang xử lý…' : 'Cập nhật mật khẩu'}
              </button>
            </>
          }
        >
          <p className="drawer-lead">
            Đặt mật khẩu mới cho <strong>{resetting.username}</strong>. Mật khẩu cũ và các phiên đăng nhập hiện tại sẽ hết hiệu lực.
          </p>
          <div className="form-grid drawer-form">
            <div className="field">
              <label className="field-label"><b>Mật khẩu mới <span style={{ color: 'var(--red)' }}>*</span></b></label>
              <input
                placeholder="Nhập mật khẩu mới"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                value={newPassword}
                onChange={event => { setNewPassword(event.target.value); setResetError(undefined) }}
              />
              <small className="field-help">6–72 ký tự, tối đa 72 byte UTF-8.</small>
            </div>
            <div className="field">
              <label className="field-label"><b>Nhập lại mật khẩu mới <span style={{ color: 'var(--red)' }}>*</span></b></label>
              <input
                placeholder="Nhập lại mật khẩu mới"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => { setConfirmPassword(event.target.value); setResetError(undefined) }}
              />
            </div>
          </div>
          {(resetError || resetPassword.isError) && (
            <div className="dialog-error" role="alert" style={{ marginTop: '1rem' }}>
              {resetError ?? errorMessage(resetPassword.error)}
            </div>
          )}
        </DetailDrawer>
      )}

      {confirming && (
        <ConfirmDialog
          title={`${confirming.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'} tài khoản?`}
          confirmLabel={confirming.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
          busy={status.isPending}
          onCancel={() => setConfirming(undefined)}
          onConfirm={() => status.mutate(confirming)}
        >
          <p>
            {confirming.status === 'ACTIVE'
              ? 'Tài khoản sẽ không thể đăng nhập cho tới khi được kích hoạt lại.'
              : 'Tài khoản sẽ có thể đăng nhập và sử dụng quyền được cấp.'}
          </p>
          <strong>{confirming.fullName} · {confirming.username}</strong>
          {status.isError && <ErrorState error={status.error} />}
        </ConfirmDialog>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}