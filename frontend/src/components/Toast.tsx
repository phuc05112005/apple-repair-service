import { useEffect } from 'react'

export function Toast({
  message,
  tone = 'success',
  duration = 3000,
  onClose,
}: {
  message: string
  tone?: 'success' | 'danger'
  duration?: number
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className={`toast toast--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span aria-hidden="true">{tone === 'success' ? '✓' : '!'}</span>
      <p>{message}</p>
      <button aria-label="Đóng thông báo" onClick={onClose}>
        ×
      </button>
    </div>
  )
}