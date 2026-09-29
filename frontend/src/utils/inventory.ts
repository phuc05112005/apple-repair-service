import type { InventoryTransactionResponse } from '../api/contracts'

export function inventoryTransactionCode(transaction: Pick<InventoryTransactionResponse, 'id' | 'transactionType' | 'transactionCode'>) {
  if (transaction.transactionCode) return transaction.transactionCode
  const prefix = transaction.transactionType === 'TRANSFER'
    ? 'CHUYEN'
    : transaction.transactionType === 'STOCK_IN' || transaction.transactionType === 'USAGE_RETURN'
      ? 'NHAP'
      : 'XUAT'
  return `${prefix}_${String(transaction.id).padStart(6, '0')}`
}
