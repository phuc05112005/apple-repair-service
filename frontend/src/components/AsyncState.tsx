import type { ReactNode } from 'react'
import { ApiError } from '../api/client'

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className="state-card" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="state-card state-card--empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>
}

export function ErrorState({ error, retry, title = 'Chưa thể tải dữ liệu', description }: { error: unknown; retry?: () => void; title?: string; description?: string }) {
  const message = description ?? (error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.')
  return <div className="state-card state-card--error" role="alert"><strong>{title}</strong><p>{message}</p>{retry && <button type="button" className="button button--secondary" onClick={retry}>Thử lại</button>}</div>
}
