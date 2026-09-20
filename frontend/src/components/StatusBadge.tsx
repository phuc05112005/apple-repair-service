export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'teal' | 'rose' | 'cyan'

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return <span className={`status status--${tone}`}>{label}</span>
}
