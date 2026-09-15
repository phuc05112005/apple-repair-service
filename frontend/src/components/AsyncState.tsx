import type { ReactNode } from 'react'
import { ApiError } from '../api/client'

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div className="state-card" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="state-card state-card--empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  return <div className="state-card state-card--error" role="alert"><strong>Chưa thể tải dữ liệu</strong><p>{message}</p>{retry && <button className="button button--secondary" onClick={retry}>Thử lại</button>}</div>
}
