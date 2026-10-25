import { useState, useEffect, useRef } from 'react'
import { profileApi } from '../api/authApi'
import type { UserResponse } from '../api/contracts'

interface Props {
  initialTab?: 'profile' | 'password'
  onClose: () => void
  onProfileUpdated?: (updatedUser: UserResponse) => void
}

function getErrorMessage(err: unknown, fallbackMessage: string): string {
  if (err instanceof Error && err.message) {
    return err.message
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return fallbackMessage
}

export function UserProfileModal({ initialTab = 'profile', onClose, onProfileUpdated }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<'profile' | 'password'>(initialTab)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<UserResponse | null>(null)

  // State Form Profile
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // State Form Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Mở dialog dạng modal
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  // Tải dữ liệu người dùng
  useEffect(() => {
    let active = true
    profileApi.getProfile()
      .then(res => {
        if (!active) return
        setUser(res)
        setFullName(res.fullName || '')
        setPhone(res.phone || '')
        setEmail(res.email || '')
      })
      .catch((err: unknown) => {
        if (!active) return
        setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể tải thông tin cá nhân') })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSubmitting(true)
    try {
      const updated = await profileApi.updateProfile({ fullName, phone, email })
      setUser(updated)
      if (onProfileUpdated) onProfileUpdated(updated)
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' })

      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Cập nhật thất bại') })
      setSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không trùng khớp' })
      return
    }
    setSubmitting(true)
    try {
      await profileApi.changePassword({ currentPassword, newPassword, confirmPassword })
      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Đổi mật khẩu thất bại') })
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="profile-modal-title"
      style={{ width: 'min(500px, calc(100% - 2rem))' }}
      onCancel={(e) => {
        e.preventDefault()
        if (!submitting) onClose()
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <span className="eyebrow" style={{ marginBottom: '0.2rem' }}>Tài khoản</span>
          <h2 id="profile-modal-title" style={{ margin: 0, fontSize: '1.5rem' }}>Quản lý tài khoản</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng"
          disabled={submitting}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="segmented">
        <button
          type="button"
          className={tab === 'profile' ? 'active' : ''}
          onClick={() => { setTab('profile'); setMessage(null) }}
        >
          Thông tin cá nhân
        </button>
        <button
          type="button"
          className={tab === 'password' ? 'active' : ''}
          onClick={() => { setTab('password'); setMessage(null) }}
        >
          Đổi mật khẩu
        </button>
      </div>

      {message && (
        <div
          className={message.type === 'error' ? 'dialog-error' : 'auth-notice'}
          style={
            message.type === 'success'
              ? { borderColor: '#a8d3b7', color: '#175b35', background: '#edf8f0', marginBottom: '1rem' }
              : { marginBottom: '1rem' }
          }
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 0', gap: '0.5rem', color: 'var(--muted)' }}>
          <div className="spinner" />
          <span>Đang tải thông tin...</span>
        </div>
      ) : (
        <>
          {tab === 'profile' && (
            <form onSubmit={handleUpdateProfile}>
              <div className="field">
                <label className="field-label"><b>Tên đăng nhập</b></label>
                <input
                  type="text"
                  disabled
                  value={user?.username || ''}
                  style={{ opacity: 0.65, cursor: 'not-allowed', background: '#f4f4f1' }}
                />
              </div>

              <div className="field">
                <label className="field-label"><b>Họ và tên</b></label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="field">
                <label className="field-label"><b>Số điện thoại</b></label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0901234567"
                />
              </div>

              <div className="field">
                <label className="field-label"><b>Email liên hệ</b></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div className="dialog-actions">
                <button type="button" className="button button--quiet" disabled={submitting} onClick={onClose}>
                  Hủy
                </button>
                <button type="submit" className="button button--primary" disabled={submitting}>
                  {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label className="field-label"><b>Mật khẩu hiện tại</b></label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="field">
                <label className="field-label"><b>Mật khẩu mới</b></label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>

              <div className="field">
                <label className="field-label"><b>Xác nhận mật khẩu mới</b></label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <div className="dialog-actions">
                <button type="button" className="button button--quiet" disabled={submitting} onClick={onClose}>
                  Hủy
                </button>
                <button type="submit" className="button button--primary" disabled={submitting}>
                  {submitting ? 'Đang xử lý…' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </dialog>
  )
}