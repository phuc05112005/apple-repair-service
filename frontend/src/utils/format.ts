export const formatMoney = (value: number | null | undefined) => value == null
  ? 'Giá được xác nhận sau khi kiểm tra'
  : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export const formatDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
  : '—'

export const formatTime = (value: string) => value.slice(0, 5)
