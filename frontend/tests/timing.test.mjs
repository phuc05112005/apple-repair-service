import test from 'node:test'
import assert from 'node:assert/strict'
import { countdown, timingAttention } from '../src/utils/timing.ts'
const now = Date.parse('2026-09-22T09:00:00+07:00')
test('countdown has consistent green/yellow/red thresholds and overdue text', () => {
 assert.equal(countdown('2026-09-22T10:00:00',60,now).tone,'green')
 assert.equal(countdown('2026-09-22T09:15:00',60,now).tone,'yellow')
 assert.deepEqual(countdown('2026-09-22T08:59:00',60,now),{tone:'red',text:'Quá 1 phút',minutes:-1})
 assert.equal(countdown(null,60,now).tone,'unknown')
 assert.equal(countdown('invalid',60,now).tone,'unknown')
})
test('unassigned warning does not mutate business status and terminal work is ignored',()=>{
 const timing={assignmentDueAt:'2026-09-22T09:15:00',estimatedCompletionAt:'2026-09-22T10:00:00',estimatedDurationMinutes:60}
 assert.equal(timingAttention('WAITING_ASSIGNMENT',timing,now+10*60000),2)
 assert.equal(timingAttention('WAITING_ASSIGNMENT',timing,now+16*60000),0)
 assert.equal(timingAttention('HANDED_OVER',timing,now+120*60000),4)
})
test('offset-free timestamps are Vietnam wall time across the UTC date boundary',()=>{
 const midnight=Date.parse('2026-09-21T17:00:00Z')
 assert.equal(countdown('2026-09-22T00:10:00',30,midnight).minutes,10)
 assert.equal(countdown('2026-09-21T17:10:00Z',30,midnight).minutes,10)
})
