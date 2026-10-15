import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deselectAllEligible, removeSavedSelections, selectAllEligible, toggleSelection } from '../src/utils/technicianSelection.ts'

test('selection survives filter changes because it is independent of visible rows', () => {
  let selected = new Set([1, 2])
  selected = toggleSelection(selected, 3)
  // Filtering to show only id 4 does not touch ids outside the visible list.
  selected = selectAllEligible(selected, [4])
  assert.deepEqual([...selected].sort(), [1, 2, 3, 4])
})

test('unchecking one technician leaves the others selected', () => {
  const selected = toggleSelection(new Set([1, 2, 3]), 2)
  assert.deepEqual([...selected].sort(), [1, 3])
})

test('select-all and clear-all only affect the eligible visible ids', () => {
  const selected = new Set([9])
  assert.deepEqual([...selectAllEligible(selected, [1, 2])].sort(), [1, 2, 9])
  assert.deepEqual([...deselectAllEligible(new Set([1, 2, 9]), [1, 2])], [9])
})

test('saved technicians are deselected and failed ones stay selected for retry', () => {
  const selected = new Set([1, 2, 3])
  const outcomes = [
    { id: 1, ok: true },
    { id: 2, ok: false },
    { id: 3, ok: true },
  ]
  assert.deepEqual([...removeSavedSelections(selected, outcomes)], [2])
})

test('a fully successful save leaves no selection to resubmit', () => {
  assert.equal(removeSavedSelections(new Set([1, 2]), [{ id: 1, ok: true }, { id: 2, ok: true }]).size, 0)
})
