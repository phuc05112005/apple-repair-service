import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function LoginPage() {
  const { status, user, login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  if (status === 'authenticated' && user) return <Navigate to={`/internal/${user.role.toLowerCase()}`} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const current = await login(username, password)
      const requested = (location.state as { from?: string } | null)?.from
      const roleBase = `/internal/${current.role.toLowerCase()}`
      navigate(requested?.startsWith(roleBase) ? requested : roleBase, { replace: true })
    } catch (reason) {
      setError(reason instanceof ApiError
        ? reason.code === 'NETWORK_ERROR' ? 'Không thể kết nối tới máy chủ. Vui lòng thử lại.' : reason.message
        : 'Không thể đăng nhập. Vui lòng thử lại.')
    }
  }

  return <main className="login-page"><section className="login-visual"><div className="brand brand--light"><span className="brand-mark">T</span><span>TáoCare Ops</span></div><div><span className="eyebrow">Khu vực nội bộ</span><h1>Vận hành dịch vụ<br />rõ ràng, liền mạch.</h1><p>Một không gian tập trung dành cho đội ngũ tiếp nhận, kỹ thuật và quản trị.</p></div><small>Hệ thống quản lý dịch vụ kỹ thuật</small></section><section className="login-form-wrap"><form onSubmit={submit} className="login-card"><div className="login-card__heading"><span className="eyebrow">Đăng nhập nhân viên</span><h2>Chào mừng trở lại</h2><p>Sử dụng tài khoản nội bộ do quản trị viên cấp.</p></div>{notice && <div className="auth-notice" role="status"><span>{notice}</span><button type="button" aria-label="Đóng thông báo" onClick={clearNotice}>×</button></div>}<label className="field"><span>Tên đăng nhập</span><input placeholder="Nhập tên đăng nhập" autoComplete="username" maxLength={255} value={username} onChange={event => setUsername(event.target.value)} /></label><label className="field"><span>Mật khẩu</span><div className="password-field"><input placeholder="Nhập mật khẩu" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />{showPassword && <path d="m4 4 16 16" />}</svg></button></div></label>{error && <div className="inline-error" role="alert">{error}</div>}<button className="button button--primary button--full" disabled={!username.trim() || !password || status === 'authenticating'}>{status === 'authenticating' ? 'Đang xác thực…' : 'Đăng nhập'}</button></form></section></main>
}
