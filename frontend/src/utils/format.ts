export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/** Business calendar date, independent of the browser's timezone. Never convert a date-only value to UTC. */
export function businessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (name: string) => parts.find(part => part.type === name)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addBusinessDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

/** Legacy API LocalDateTime values are Vietnam wall time; JWT/error Instants retain their explicit offset. */
function timestamp(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}+07:00`)
}

export const formatMoney = (value: number | null | undefined) => value == null
  ? 'Giá được xác nhận sau khi kiểm tra'
  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export const formatDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: BUSINESS_TIME_ZONE }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`))
  : '—'

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = timestamp(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date)
}

export const formatClock = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(timestamp(value))

export const formatTime = (value: string) => value.slice(0, 5)
