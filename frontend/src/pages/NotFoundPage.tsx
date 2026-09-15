import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <main className="not-found"><span>404</span><h1>Không tìm thấy trang.</h1><p>Đường dẫn có thể đã thay đổi hoặc không thuộc quyền truy cập hiện tại.</p><Link className="button button--primary" to="/">Về trang chủ</Link></main>
}
