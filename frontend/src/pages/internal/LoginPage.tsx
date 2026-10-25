import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { authApi } from '../../api/authApi'
import { useAuth } from '../../auth/useAuth'
import { internalDestination } from '../../auth/session'
import { LoadingState } from '../../components/AsyncState'

export function LoginPage() {
  const { status, user, login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // State Quên mật khẩu
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

  const requested = (location.state as { from?: string } | null)?.from
  if (status === 'bootstrapping') return <div className="route-loading"><LoadingState label="Đang khôi phục phiên đăng nhập…" /></div>
  if (status === 'authenticated' && user) return <Navigate to={internalDestination(user.role, requested)} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const current = await login(username, password)
      navigate(internalDestination(current.role, requested), { replace: true })
    } catch (reason) {
      setError(reason instanceof ApiError
        ? reason.code === 'NETWORK_ERROR' ? 'Không thể kết nối tới máy chủ. Vui lòng thử lại.' : reason.message
        : 'Không thể đăng nhập. Vui lòng thử lại.')
    }
  }

  async function submitForgot(event: FormEvent) {
  event.preventDefault()
  setForgotError('')
  setForgotSuccess('')
  
  if (!forgotEmail.trim()) {
    setForgotError('Vui lòng nhập địa chỉ email khôi phục.')
    return
  }
  
  setForgotLoading(true)
  try {
    await authApi.forgotPassword(forgotEmail.trim())
    // Luôn đặt thông báo thành công sau khi gọi API hoàn tất
setForgotSuccess('Yêu cầu thành công! Mật khẩu mới đã được gửi tới email của bạn (có thể mất vài phút, vui lòng kiểm tra cả hòm thư Spam/Rác).')
    setTimeout(() => {
      setShowForgotModal(false)
      setForgotEmail('')
      setForgotSuccess('')
    }, 3500)
  } catch (reason) {
    setForgotError(reason instanceof ApiError ? reason.message : 'Không thể gửi yêu cầu khôi phục. Vui lòng thử lại.')
  } finally {
    setForgotLoading(false)
  }
}

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand brand--light"><span className="brand-mark">T</span><span>TáoCare Ops</span></div>
        <div><span className="eyebrow">Khu vực nội bộ</span><h1>Vận hành dịch vụ<br />rõ ràng, liền mạch.</h1><p>Một không gian tập trung dành cho đội ngũ tiếp nhận, kỹ thuật và quản trị.</p></div>
        <small>Hệ thống quản lý dịch vụ kỹ thuật</small>
      </section>

      <section className="login-form-wrap">
        <form onSubmit={submit} className="login-card">
          <div className="login-card__heading">
            <span className="eyebrow">Đăng nhập nhân viên</span>
            <h2>Chào mừng trở lại</h2>
            <p>Sử dụng tài khoản nội bộ do quản trị viên cấp.</p>
          </div>

          {notice && (
            <div className="auth-notice" role="status">
              <span>{notice}</span>
              <button type="button" aria-label="Đóng thông báo" onClick={clearNotice}>×</button>
            </div>
          )}

          <label className="field">
            <span>Tên đăng nhập</span>
            <input placeholder="Nhập tên đăng nhập" autoComplete="username" maxLength={255} value={username} onChange={event => setUsername(event.target.value)} />
          </label>

          <label className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Mật khẩu</span>
              <button
                type="button"
                className="text-action"
                style={{ fontSize: '0.8rem', fontWeight: 600, padding: 0 }}
                onClick={() => {
                  setShowForgotModal(true)
                  setForgotEmail('')
                  setForgotError('')
                  setForgotSuccess('')
                }}
              >
                Quên mật khẩu?
              </button>
            </div>

            <div className="password-field">
              <input placeholder="Nhập mật khẩu" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={72} value={password} onChange={event => setPassword(event.target.value)} />
              <button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                  {showPassword && <path d="m4 4 16 16" />}
                </svg>
              </button>
            </div>
          </label>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <button className="button button--primary button--full" disabled={!username.trim() || !password || status === 'authenticating'}>
            {status === 'authenticating' ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>
        </form>
      </section>

      {showForgotModal && (
        <dialog
          open
          className="confirm-dialog"
          aria-labelledby="forgot-modal-title"
          style={{ width: 'min(460px, calc(100% - 2rem))' }}
        >
          <div className="dialog-icon dialog-icon--info" aria-hidden="true">🔑</div>
          <h2 id="forgot-modal-title" style={{ marginTop: '0.8rem', fontSize: '1.4rem' }}>Khôi phục mật khẩu</h2>
          <p className="dialog-copy" style={{ marginBottom: '1.25rem' }}>
            Nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi sẽ gửi một liên kết để thiết lập lại mật khẩu.
          </p>

          {forgotSuccess && (
            <div className="auth-notice" style={{ borderColor: '#a8d3b7', color: '#175b35', background: '#edf8f0', marginBottom: '1rem' }}>
              <span>{forgotSuccess}</span>
            </div>
          )}

          {forgotError && <div className="dialog-error" role="alert" style={{ marginBottom: '1rem' }}>{forgotError}</div>}

          <form onSubmit={submitForgot}>
            <label className="field">
              <span>Email liên hệ</span>
              <input
                type="email"
                required
                placeholder="nhanvien@taocare.vn"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                disabled={forgotLoading}
              />
            </label>

            <div className="dialog-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="button button--quiet"
                disabled={forgotLoading}
                onClick={() => setShowForgotModal(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={forgotLoading}
              >
                {forgotLoading ? 'Đang gửi…' : 'Gửi link khôi phục'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  )
}