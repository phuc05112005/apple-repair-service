export function Toast({ message, tone = 'success', onClose }: { message: string; tone?: 'success' | 'danger'; onClose: () => void }) {
  return <div className={`toast toast--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}><span aria-hidden="true">{tone === 'success' ? '✓' : '!'}</span><p>{message}</p><button aria-label="Đóng thông báo" onClick={onClose}>×</button></div>
}
