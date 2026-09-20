export const formatMoney = (value: number | null | undefined) => value == null
  ? 'Giá được xác nhận sau khi kiểm tra'
  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export const formatDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
  : '—'

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date)
}

export const formatTime = (value: string) => value.slice(0, 5)
