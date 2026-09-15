import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { UserResponse, UserRole } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { useAuth } from '../../../auth/useAuth'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'

const blank = { username: '', password: '', fullName: '', phone: '', role: 'RECEPTIONIST' as UserRole }

export function UsersPage() {
  const client = useQueryClient()
  const { user: currentUser } = useAuth()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserResponse>()
  const [confirming, setConfirming] = useState<UserResponse>()
  const [form, setForm] = useState(blank)
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'users'] })
  const closeForm = () => { setEditing(undefined); setShowForm(false); setForm(blank) }
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return adminApi.createUser({ ...form, phone: form.phone || undefined })
      const updated = await adminApi.updateUserProfile(editing.id, { fullName: form.fullName, phone: form.phone || undefined })
      return editing.role === form.role ? updated : adminApi.updateUserRole(editing.id, form.role)
    },
    onSuccess: async () => { closeForm(); await refresh() },
  })
  const status = useMutation({ mutationFn: (target: UserResponse) => adminApi.updateUserStatus(target.id, target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'), onSuccess: async () => { setConfirming(undefined); await refresh() } })
  function edit(target: UserResponse) { setEditing(target); setShowForm(true); setForm({ username: target.username, password: '', fullName: target.fullName, phone: target.phone ?? '', role: target.role }) }

  return <div className="workspace-page"><header><span className="eyebrow">Quản trị</span><h1>Tài khoản nội bộ</h1><p>Tạo và quản lý đúng ba vai trò ADMIN, RECEPTIONIST, TECHNICIAN.</p><button className="button button--primary" onClick={() => { setEditing(undefined); setForm(blank); setShowForm(true) }}>+ Thêm tài khoản</button></header>
    {showForm && <section className="form-panel"><div className="panel-heading"><span>{editing ? 'SỬA' : 'MỚI'}</span><div><h2>{editing ? `Cập nhật ${editing.username}` : 'Thêm tài khoản'}</h2><p>Mật khẩu chỉ được gửi khi tạo và không được hiển thị lại.</p></div></div><div className="form-grid"><label className="field"><span>Tên đăng nhập</span><input disabled={Boolean(editing)} value={form.username} onChange={event => setForm(value => ({ ...value, username: event.target.value }))} /></label>{!editing && <label className="field"><span>Mật khẩu ban đầu</span><input type="password" minLength={10} maxLength={72} autoComplete="new-password" value={form.password} onChange={event => setForm(value => ({ ...value, password: event.target.value }))} /></label>}<label className="field"><span>Họ tên</span><input value={form.fullName} onChange={event => setForm(value => ({ ...value, fullName: event.target.value }))} /></label><label className="field"><span>Điện thoại</span><input value={form.phone} onChange={event => setForm(value => ({ ...value, phone: event.target.value }))} /></label><label className="field"><span>Vai trò</span><select disabled={editing?.id === currentUser?.id} value={form.role} onChange={event => setForm(value => ({ ...value, role: event.target.value as UserRole }))}><option value="ADMIN">ADMIN</option><option value="RECEPTIONIST">RECEPTIONIST</option><option value="TECHNICIAN">TECHNICIAN</option></select></label></div>{save.isError && <ErrorState error={save.error} />}<div className="panel-actions"><button className="button button--quiet" onClick={closeForm}>Hủy</button><button className="button button--primary" disabled={!form.username.trim() || !form.fullName.trim() || (!editing && form.password.length < 10) || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div></section>}
    {confirming && <section className="next-action-panel next-action-panel--waiting" role="dialog" aria-modal="true"><span>XÁC NHẬN</span><h2>Vô hiệu hóa {confirming.username}?</h2><p>Tài khoản sẽ không thể đăng nhập cho tới khi Admin kích hoạt lại.</p>{status.isError && <ErrorState error={status.error} />}<div className="button-row"><button className="button button--quiet" onClick={() => setConfirming(undefined)}>Giữ tài khoản</button><button className="button button--primary" disabled={status.isPending} onClick={() => status.mutate(confirming)}>Xác nhận vô hiệu hóa</button></div></section>}
    {users.isLoading ? <LoadingState /> : users.isError ? <ErrorState error={users.error} retry={() => users.refetch()} /> : !users.data?.length ? <EmptyState title="Chưa có tài khoản" /> : <div className="appointment-list">{users.data.map(target => <article key={target.id}><div><span className="record-code">{target.username}</span><h3>{target.fullName}</h3><p>{target.role} · {target.phone || 'Không có điện thoại'}</p></div><div><StatusBadge label={target.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'} tone={target.status === 'ACTIVE' ? 'success' : 'warning'} /><button className="button button--secondary" onClick={() => edit(target)}>Sửa</button><button className="button button--quiet" disabled={status.isPending || target.id === currentUser?.id} title={target.id === currentUser?.id ? 'Không thể vô hiệu hóa tài khoản đang đăng nhập' : undefined} onClick={() => target.status === 'ACTIVE' ? setConfirming(target) : status.mutate(target)}>{target.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></div></article>)}</div>}
  </div>
}

