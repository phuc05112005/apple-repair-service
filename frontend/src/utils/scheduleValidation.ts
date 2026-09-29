import type { SlotRule, WeeklyScheduleResponse } from '../api/contracts'

export function normalizeTime24(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value)
  if (!match) return value.slice(0, 5)
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function isValidTime24(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalizeTime24(value))
}

const label = (slot: SlotRule) => `${normalizeTime24(slot.startTime)}–${normalizeTime24(slot.endTime)}`

export function validateSlotRules(slots: SlotRule[]): string | null {
  for (const slot of slots) {
    if (!slot.startTime || !slot.endTime) return 'Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.'
    const start = normalizeTime24(slot.startTime)
    const end = normalizeTime24(slot.endTime)
    if (!isValidTime24(start) || !isValidTime24(end)) return `Khung giờ ${label(slot)} không hợp lệ. Vui lòng nhập theo định dạng 24 giờ HH:mm.`
    if (start >= end) return `Khung giờ ${label(slot)} không hợp lệ. Giờ bắt đầu phải trước giờ kết thúc.`
  }
  const seen = new Set<string>()
  for (const slot of slots) {
    const key = `${normalizeTime24(slot.startTime)}/${normalizeTime24(slot.endTime)}`
    if (seen.has(key)) return `Khung giờ ${label(slot)} bị trùng.`
    seen.add(key)
  }
  const enabled = slots.filter(slot => slot.enabled).sort((a, b) => normalizeTime24(a.startTime).localeCompare(normalizeTime24(b.startTime)) || normalizeTime24(a.endTime).localeCompare(normalizeTime24(b.endTime)))
  for (let index = 1; index < enabled.length; index += 1) {
    if (normalizeTime24(enabled[index].startTime) < normalizeTime24(enabled[index - 1].endTime)) return `Khung giờ ${label(enabled[index])} chồng lấn với ${label(enabled[index - 1])}.`
  }
  return null
}

export function validateWeeklySchedules(days: WeeklyScheduleResponse[]): string | null {
  for (const day of days) {
    if (day.enabled && day.slots.length === 0) return `${day.weekday === 7 ? 'Chủ nhật' : `Thứ ${day.weekday + 1}`}: Ngày đang mở phải có ít nhất một khung giờ.`
    const error = validateSlotRules(day.slots)
    if (error) return `${day.weekday === 7 ? 'Chủ nhật' : `Thứ ${day.weekday + 1}`}: ${error}`
  }
  return null
}

export function cloneSchedule<T>(value: T): T { return structuredClone(value) }
