import type { SlotRule, WeeklyScheduleResponse } from '../api/contracts'

const short = (value: string) => value.slice(0, 5)
const label = (slot: SlotRule) => `${short(slot.startTime)}–${short(slot.endTime)}`

export function validateSlotRules(slots: SlotRule[]): string | null {
  for (const slot of slots) {
    if (!slot.startTime || !slot.endTime) return 'Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.'
    if (slot.startTime >= slot.endTime) return `Khung giờ ${label(slot)} không hợp lệ. Giờ bắt đầu phải trước giờ kết thúc.`
  }
  const seen = new Set<string>()
  for (const slot of slots) {
    const key = `${slot.startTime}/${slot.endTime}`
    if (seen.has(key)) return `Khung giờ ${label(slot)} bị trùng.`
    seen.add(key)
  }
  const enabled = slots.filter(slot => slot.enabled).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime))
  for (let index = 1; index < enabled.length; index += 1) {
    if (enabled[index].startTime < enabled[index - 1].endTime) return `Khung giờ ${label(enabled[index])} chồng lấn với ${label(enabled[index - 1])}.`
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
