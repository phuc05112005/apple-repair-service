import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
      setError(reason instanceof ApiError ? reason.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    }
  }

  return <main className="login-page"><section className="login-visual"><div className="brand brand--light"><span className="brand-mark">T</span><span>TáoCare Ops</span></div><div><span className="eyebrow">Khu vực nội bộ</span><h1>Tập trung vào<br />công việc cần làm.</h1><p>Không gian vận hành dành riêng cho nhân viên được phân quyền.</p></div><small>Hệ thống quản lý dịch vụ kỹ thuật</small></section><section className="login-form-wrap"><form onSubmit={submit}><span className="eyebrow">Đăng nhập nhân viên</span><h2>Chào mừng trở lại.</h2><p>Sử dụng tài khoản nội bộ do quản trị viên cấp.</p><label className="field"><span>Tên đăng nhập</span><input placeholder="Tên đăng nhập do quản trị viên cấp" autoComplete="username" maxLength={255} value={username} onChange={event => setUsername(event.target.value)} /></label><label className="field"><span>Mật khẩu</span><input placeholder="Nhập mật khẩu" type="password" autoComplete="current-password" maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <div className="inline-error" role="alert">{error}</div>}<button className="button button--primary button--full" disabled={!username.trim() || !password || status === 'authenticating'}>{status === 'authenticating' ? 'Đang xác thực…' : 'Đăng nhập'}</button></form></section></main>
}
