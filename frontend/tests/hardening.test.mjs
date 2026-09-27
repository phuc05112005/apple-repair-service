import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneSchedule, validateSlotRules, validateWeeklySchedules } from '../src/utils/scheduleValidation.ts'
import { AUTH_SESSION_KEY, clearAuthSession, isSessionExpired, readAuthSession, writeAuthSession } from '../src/auth/session.ts'

test('weekly schedule accepts multiple slots and copied days remain independently editable', () => {
  const slots = [
    { startTime: '08:00', endTime: '09:00', enabled: true },
    { startTime: '09:30', endTime: '10:30', enabled: true },
    { startTime: '14:00', endTime: '15:00', enabled: false },
  ]
  const week = Array.from({ length: 7 }, (_, index) => ({ branchId: 1, weekday: index + 1, enabled: true, slots: cloneSchedule(slots) }))
  assert.equal(validateWeeklySchedules(week), null)
  week[1].slots[0].startTime = '07:30'
  assert.equal(week[0].slots[0].startTime, '08:00')
})

test('weekly schedule explains overlap, duplicate and invalid ranges', () => {
  assert.equal(validateSlotRules([
    { startTime: '09:00', endTime: '10:00', enabled: true },
    { startTime: '09:30', endTime: '11:00', enabled: true },
  ]), 'Khung giờ 09:30–11:00 chồng lấn với 09:00–10:00.')
  assert.match(validateSlotRules([
    { startTime: '09:00', endTime: '10:00', enabled: true },
    { startTime: '09:00', endTime: '10:00', enabled: false },
  ]), /bị trùng/)
  assert.match(validateSlotRules([{ startTime: '10:00', endTime: '09:00', enabled: true }]), /không hợp lệ/)
})

test('auth session persists only token metadata and can be cleared', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  writeAuthSession({ token: 'jwt-value', expiresAt: '2026-09-28T00:00:00Z' }, storage)
  assert.deepEqual(readAuthSession(storage), { token: 'jwt-value', expiresAt: '2026-09-28T00:00:00Z' })
  assert.equal(values.has('password'), false)
  assert.equal(values.has(AUTH_SESSION_KEY), true)
  clearAuthSession(storage)
  assert.equal(readAuthSession(storage), null)
})

test('auth bootstrap detects expired or invalid expiry timestamps', () => {
  assert.equal(isSessionExpired('2026-09-27T00:00:00Z', Date.parse('2026-09-27T00:00:00Z')), true)
  assert.equal(isSessionExpired('2026-09-27T00:00:01Z', Date.parse('2026-09-27T00:00:00Z')), false)
  assert.equal(isSessionExpired('invalid', Date.now()), true)
})
