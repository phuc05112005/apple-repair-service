import test from 'node:test'
import assert from 'node:assert/strict'
import { inventoryTransactionCode } from '../src/utils/inventory.ts'

test('inventory transaction codes describe stock direction and transfer', () => {
  assert.equal(inventoryTransactionCode({ id: 343, transactionType: 'STOCK_IN' }), 'NHAP_000343')
  assert.equal(inventoryTransactionCode({ id: 344, transactionType: 'STOCK_OUT' }), 'XUAT_000344')
  assert.equal(inventoryTransactionCode({ id: 345, transactionType: 'USAGE_OUT' }), 'XUAT_000345')
  assert.equal(inventoryTransactionCode({ id: 346, transactionType: 'USAGE_RETURN' }), 'NHAP_000346')
  assert.equal(inventoryTransactionCode({ id: 347, transactionType: 'TRANSFER' }), 'CHUYEN_000347')
})

test('inventory transaction code from backend remains authoritative', () => {
  assert.equal(inventoryTransactionCode({ id: 1, transactionType: 'STOCK_IN', transactionCode: 'NHAP_009999' }), 'NHAP_009999')
})
