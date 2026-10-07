import test from 'node:test'
import assert from 'node:assert/strict'
import { canAssignCandidate, predictionSourceLabel, predictionWarningLabel } from '../src/utils/recommendation.ts'

test('candidate recommendation labels ML source truthfully', () => {
  assert.equal(predictionSourceLabel('ML'), 'Dự đoán theo mô hình')
})

test('candidate recommendation distinguishes standard-duration fallback', () => {
  assert.equal(predictionSourceLabel('STANDARD_DURATION_FALLBACK'), 'Ước tính theo thời gian chuẩn')
  assert.match(predictionWarningLabel('ML_TIMEOUT'), /thời gian chuẩn/)
})

test('unseen catalog and cold-start warnings are translated without exposing technical codes', () => {
  assert.equal(predictionWarningLabel('UNSEEN_CATALOG_CATEGORY'), 'Ước tính sử dụng danh mục dịch vụ mới.')
  assert.equal(predictionWarningLabel('COLD_START_TECHNICIAN'), 'Kỹ thuật viên chưa có nhiều lịch sử xử lý tương tự.')
  assert.equal(predictionWarningLabel('UNKNOWN_INTERNAL_WARNING'), null)
})

test('candidate cannot be assigned without a schedulable completion time', () => {
  assert.equal(canAssignCandidate({ eligible: true, estimatedCompletionAt: '2026-10-07T10:30:00' }), true)
  assert.equal(canAssignCandidate({ eligible: false, estimatedCompletionAt: '2026-10-07T10:30:00' }), false)
  assert.equal(canAssignCandidate({ eligible: true, estimatedCompletionAt: null }), false)
})
