export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) {
  return <span className={`status status--${tone}`}>{label}</span>
}
