import test from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, addBusinessDays, formatDateTime, formatDate } from '../src/utils/format.ts'

test('Vietnam business date at midnight is independent of browser timezone', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['UTC', 'Asia/Ho_Chi_Minh', 'America/Los_Angeles']) {
      process.env.TZ = zone
      assert.equal(businessDate(new Date('2026-09-20T16:59:59Z')), '2026-09-20')
      assert.equal(businessDate(new Date('2026-09-20T17:00:00Z')), '2026-09-21')
      assert.equal(businessDate(new Date('2026-09-20T17:01:00Z')), '2026-09-21')
      assert.equal(formatDateTime('2026-09-21T00:01:00'), formatDateTime('2026-09-20T17:01:00Z'))
      assert.match(formatDate('2026-09-21'), /21/)
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
})

test('date-only arithmetic keeps appointment dates across month/year boundaries', () => {
  assert.equal(addBusinessDays('2026-01-01', -1), '2025-12-31')
  assert.equal(addBusinessDays('2024-03-01', -1), '2024-02-29')
  assert.equal(addBusinessDays('2026-09-21', -30), '2026-08-22')
})
