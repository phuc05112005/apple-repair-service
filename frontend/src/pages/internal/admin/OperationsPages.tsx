import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { BranchInventoryResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { DefectiveInventoryPanel } from '../../../components/DefectiveInventoryPanel'
import { businessDateTimeInput, formatDateTime } from '../../../utils/format'
import { inventoryTransactionCode } from '../../../utils/inventory'
import { compareText } from '../../../utils/table'

type ActionType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER'

export type InventoryTransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'USAGE_OUT' | 'USAGE_RETURN' | 'TRANSFER'

export interface InventoryTransactionRecord {
  id: number
  transactionType: InventoryTransactionType
  sourceBranchId?: number | null
  destinationBranchId?: number | null
  partId: number
  quantity: number
  costPrice?: number | null
  cost_price?: number | null
  supplierName?: string | null
  supplier_name?: string | null
  createdAt: string
  recordedByName?: string | null
  recorded_by_name?: string | null
  lotCode?: string | null
  partUsageId?: number | null
  note?: string | null
}

const inventoryTransactionLabels: Record<InventoryTransactionType, string> = {
  STOCK_IN: 'Nhập kho',
  STOCK_OUT: 'Xuất kho',
  USAGE_OUT: 'Dùng cho sửa chữa',
  USAGE_RETURN: 'Hoàn linh kiện',
  TRANSFER: 'Chuyển chi nhánh',
} as const

function generateCode(type: ActionType, partCode?: string) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  const prefix = type === 'STOCK_IN' ? 'NHAP' : type === 'STOCK_OUT' ? 'XUAT' : 'CHUYEN'
  const cleanPartCode = partCode ? partCode.replace(/[^a-zA-Z0-9]/g, '') : 'LK'
  return `${prefix}_${dateStr}_${cleanPartCode}`
}

const formatVND = (val?: number | null) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0 VNĐ'
  return new Intl.NumberFormat('vi-VN').format(Number(val)) + ' VNĐ'
}

export function InventoryPage() {
  const client = useQueryClient()
  const location = useLocation()

  const initialPartId = (location.state as { partId?: number } | null)?.partId

  // --- Form State ---
  const [actionType, setActionType] = useState<ActionType>('STOCK_IN')
  const [branchId, setBranchId] = useState<number>()
  const [partId, setPartId] = useState<number | undefined>(initialPartId)
  const [destinationBranchId, setDestinationBranchId] = useState<number>()
  const [quantity, setQuantity] = useState<number>(1)
  const [supplier, setSupplier] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [totalPrice, setTotalPrice] = useState<string>('')
  const [note, setNote] = useState('')
  const [lotCode, setLotCode] = useState(() => generateCode('STOCK_IN'))
  const [receivedAt, setReceivedAt] = useState(businessDateTimeInput())
  const [showAdjustment, setShowAdjustment] = useState<boolean>(Boolean(initialPartId))
  const [isRowAdjustMode, setIsRowAdjustMode] = useState<boolean>(false)

  // --- Filter State (Tồn kho) ---
  const [branchFilter, setBranchFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')

  // --- Filter State (Lịch sử) ---
  const [historyCode, setHistoryCode] = useState('')
  const [historyBranchId, setHistoryBranchId] = useState('')
  const [historyPartId, setHistoryPartId] = useState('')
  const [historyType, setHistoryType] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')

  const [toast, setToast] = useState<string>()
  const excelInput = useRef<HTMLInputElement>(null)

  // --- Queries ---
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal) })
  const models = useQuery({ queryKey: ['admin', 'device-models'], queryFn: ({ signal }) => adminApi.resourceList<{ id: number; name: string }>('device-models', signal) })
  const inventories = useQuery({ queryKey: ['admin', 'inventories'], queryFn: ({ signal }) => adminApi.inventories({}, signal) })
  const inventory = useQuery({ queryKey: ['admin', 'inventory', branchId, partId], queryFn: ({ signal }) => adminApi.inventory(branchId!, partId!, signal), enabled: Boolean(showAdjustment && branchId && partId), retry: false })
  const transactions = useQuery({ queryKey: ['admin', 'inventory-transactions', partId], queryFn: ({ signal }) => adminApi.inventoryTransactions(partId!, signal), enabled: Boolean(partId) })
  
  const history = useQuery({
    queryKey: ['admin', 'inventory-transaction-history', historyBranchId, historyPartId, historyType, historyFrom, historyTo, historyCode],
    queryFn: ({ signal }) =>
      adminApi.inventoryTransactionHistory(
        {
          branchId: historyBranchId ? Number(historyBranchId) : undefined,
          partId: historyPartId ? Number(historyPartId) : undefined,
          transactionType: historyType || undefined,
          from: historyFrom || undefined,
          to: historyTo || undefined,
          code: historyCode.trim() || undefined,
        },
        signal,
      ),
  })

  // --- Mappings ---
  const branchMap = useMemo(() => new Map(branches.data?.map(item => [item.id, item])), [branches])
  const partMap = useMemo(() => new Map(parts.data?.map(item => [item.id, item])), [parts])
  const modelMap = useMemo(() => new Map(models.data?.map(item => [item.id, item.name])), [models])
  const brands = Array.from(new Set((parts.data ?? []).map(item => item.brand).filter((value): value is string => Boolean(value)))).sort(compareText)

  const groupedParts = useMemo(() => {
    if (!parts.data) return []
    const map = new Map<string, typeof parts.data>()
    parts.data.forEach(part => {
      const brand = part.brand || 'Hãng khác'
      if (!map.has(brand)) map.set(brand, [])
      map.get(brand)!.push(part)
    })
    return Array.from(map.entries()).map(([brand, items]) => ({ brand, items }))
  }, [parts])

  function getPartModelsText(pId: number) {
    const part = partMap.get(pId) as (typeof partMap extends Map<number, infer T> ? T & { deviceModelIds?: number[]; deviceModelId?: number } : never) | undefined
    if (!part) return 'Chưa xác định'
    const pModelIds = part.deviceModelIds && part.deviceModelIds.length ? part.deviceModelIds : part.deviceModelId ? [part.deviceModelId] : []
    if (!pModelIds.length) return 'Tất cả dòng máy'
    return pModelIds.map(id => modelMap.get(id)).filter(Boolean).join(', ')
  }

  // Định dạng hiển thị linh kiện rõ ràng trong Select Dropdown
  function formatPartOptionLabel(pId: number) {
    const part = partMap.get(pId)
    if (!part) return `#${pId}`
    const modelsText = getPartModelsText(pId)
    const variantText = part.variant ? ` - ${part.variant}` : ''
    const modelInfo = modelsText && modelsText !== 'Chưa xác định' && modelsText !== 'Tất cả dòng máy' ? ` (${modelsText})` : ''
    return `${part.name}${variantText}${modelInfo} [${part.partCode}]`
  }

  // --- Handlers Tự động tính giá ---
  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, newQty)
    setQuantity(validQty)
    if (unitPrice) {
      const uPrice = Number(unitPrice) || 0
      setTotalPrice(String(uPrice * validQty))
    }
  }

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val)
    const uPrice = Number(val) || 0
    setTotalPrice(String(uPrice * quantity))
  }

  const handleTotalPriceChange = (val: string) => {
    setTotalPrice(val)
    const tPrice = Number(val) || 0
    if (quantity > 0) {
      setUnitPrice(String(Math.round(tPrice / quantity)))
    }
  }

  const handleActionTypeChange = (nextType: ActionType) => {
    setActionType(nextType)
    const selectedPart = partId ? partMap.get(partId) : undefined
    setLotCode(generateCode(nextType, selectedPart?.partCode))
  }

  const handlePartChange = (nextPartId?: number) => {
    setPartId(nextPartId)
    const selectedPart = nextPartId ? partMap.get(nextPartId) : undefined
    setLotCode(generateCode(actionType, selectedPart?.partCode))
  }

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'inventories'] }),
      client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId, partId] }),
      client.invalidateQueries({ queryKey: ['admin', 'inventory-transactions'] }),
      client.invalidateQueries({ queryKey: ['admin', 'inventory-transaction-history'] }),
    ])
  }

  // --- Mutations ---
  const stockIn = useMutation({
    mutationFn: () =>
      adminApi.stockIn({
        lotCode: lotCode.trim(),
        branchId: branchId!,
        partId: partId!,
        quantity,
        supplierName: supplier.trim() || undefined,
        costPrice: unitPrice ? Number(unitPrice) : undefined,
        receivedAt,
        sourceNote: note.trim() || undefined,
      }),
    onSuccess: async () => {
      setToast('Đã ghi nhận nhập kho thành công.')
      setSupplier('')
      setUnitPrice('')
      setTotalPrice('')
      setNote('')
      setReceivedAt(businessDateTimeInput())
      await refresh()
      setShowAdjustment(false)
    },
  })

  const stockOut = useMutation({
    mutationFn: () => adminApi.stockOut({ branchId: branchId!, partId: partId!, quantity, note: note.trim() || undefined }),
    onSuccess: async () => {
      setToast('Đã ghi nhận xuất kho thành công.')
      setNote('')
      await refresh()
      setShowAdjustment(false)
    },
  })

  const transfer = useMutation({
    mutationFn: () => adminApi.transferStock({ sourceBranchId: branchId!, destinationBranchId: destinationBranchId!, partId: partId!, quantity, note: note.trim() || undefined }),
    onSuccess: async () => {
      setToast('Đã chuyển kho thành công.')
      setNote('')
      await refresh()
      setShowAdjustment(false)
    },
  })

  const downloadTemplate = useMutation({
    mutationFn: () => adminApi.inventoryImportTemplate(),
    onSuccess: blob => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'mau-nhap-kho.xlsx'
      anchor.click()
      URL.revokeObjectURL(url)
      setToast('Đã tải file mẫu nhập kho.')
    },
  })

  const importExcel = useMutation({
    mutationFn: (file: File) => adminApi.importInventory(file),
    onSuccess: async result => {
      setToast(`Đã nhập kho thành công ${result.importedRows} giao dịch.`)
      if (excelInput.current) excelInput.current.value = ''
      await refresh()
    },
  })

  // --- Xuất CSV Lịch Sử ---
  const handleExportHistoryCSV = () => {
    if (!history.data || history.data.length === 0) {
      setToast('Không có dữ liệu lịch sử để xuất file.')
      return
    }

    const headers = [
      'Mã xuất/nhập kho',
      'Loại giao dịch',
      'Chi nhánh',
      'Linh kiện',
      'Mã linh kiện',
      'Số lượng',
      'Đơn giá nhập (VNĐ)',
      'Thành tiền (VNĐ)',
      'Nhà cung cấp',
      'Thời điểm',
      'Người ghi nhận',
      'Ghi chú / Tham chiếu',
    ]

    const historyData = (history.data ?? []) as unknown as InventoryTransactionRecord[]

    const rows = historyData.map(row => {
      const branchStr =
        row.sourceBranchId && row.destinationBranchId
          ? `${branchMap.get(row.sourceBranchId)?.name ?? `#${row.sourceBranchId}`} -> ${branchMap.get(row.destinationBranchId)?.name ?? `#${row.destinationBranchId}`}`
          : branchMap.get(row.destinationBranchId ?? row.sourceBranchId ?? -1)?.name ?? 'Hệ thống'

      const part = partMap.get(row.partId)
      const costOne = row.costPrice ?? row.cost_price ?? 0
      const totalCost = costOne * row.quantity
      const supplierName = row.supplierName ?? row.supplier_name ?? ''
      const recordedByName = row.recordedByName ?? row.recorded_by_name ?? ''

      return [
        `"${inventoryTransactionCode(row)}"`,
        `"${inventoryTransactionLabels[row.transactionType] ?? row.transactionType}"`,
        `"${branchStr.replace(/"/g, '""')}"`,
        `"${(part?.name ?? '').replace(/"/g, '""')}"`,
        `"${part?.partCode ?? ''}"`,
        row.quantity,
        costOne,
        totalCost,
        `"${supplierName.replace(/"/g, '""')}"`,
        `"${formatDateTime(row.createdAt)}"`,
        `"${recordedByName.replace(/"/g, '""')}"`,
        `"${(row.note ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `lich-su-kho-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setToast('Đã xuất file CSV lịch sử giao dịch thành công.')
  }

  // --- Columns cho Bảng Tồn Kho Main ---
  const columns: DataColumn<BranchInventoryResponse>[] = [
    {
      key: 'branch',
      label: 'Chi nhánh',
      render: row => (
        <strong style={{ whiteSpace: 'nowrap' }}>
          {branchMap.get(row.branchId)?.name ?? `#${row.branchId}`}
        </strong>
      ),
    },
    {
      key: 'part',
      label: 'Linh kiện',
      render: row => {
        const part = partMap.get(row.partId)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: '0.875rem' }}>{part?.name ?? `#${row.partId}`}</strong>
            <small style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {part?.partCode}
            </small>
          </div>
        )
      },
    },
    {
      key: 'models',
      label: 'Dòng máy tương thích',
      render: row => (
        <span className="muted-text" style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
          {getPartModelsText(row.partId)}
        </span>
      ),
    },
    {
      key: 'brand',
      label: 'Hãng',
      render: row => <span style={{ whiteSpace: 'nowrap' }}>{partMap.get(row.partId)?.brand ?? 'Chưa xác định'}</span>,
    },
    {
      key: 'variant',
      label: 'Phân loại / Dung lượng',
      render: row => <span style={{ whiteSpace: 'nowrap' }}>{partMap.get(row.partId)?.variant ?? 'Tiêu chuẩn'}</span>,
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      render: row => <strong className="quantity-cell" style={{ fontSize: '1rem' }}>{row.quantity}</strong>,
    },
    {
      key: 'updated',
      label: 'Cập nhật gần nhất',
      render: row => <span style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: 'status',
      label: 'Tình trạng',
      render: row => (
        <StatusBadge
          label={row.quantity > 0 ? 'Còn hàng' : 'Hết hàng'}
          tone={row.quantity > 0 ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'table-actions-cell',
      render: row => (
        <button
          className="text-action"
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => {
            setBranchId(row.branchId)
            handlePartChange(row.partId)
            setDestinationBranchId(undefined)
            handleActionTypeChange('STOCK_OUT')
            setIsRowAdjustMode(true)
            setShowAdjustment(true)
          }}
        >
          Điều chỉnh
        </button>
      ),
    },
  ]

  const filters: TableFilter<BranchInventoryResponse>[] = [
    { key: 'branch', label: 'Chi nhánh', value: branchFilter, onChange: setBranchFilter, options: (branches.data ?? []).map(item => ({ value: String(item.id), label: item.name })), matches: (row, value) => String(row.branchId) === value },
    { key: 'brand', label: 'Hãng', value: brandFilter, onChange: setBrandFilter, options: brands.map(value => ({ value, label: value })), matches: (row, value) => partMap.get(row.partId)?.brand === value },
    {
      key: 'model',
      label: 'Dòng máy',
      value: modelFilter,
      onChange: setModelFilter,
      options: (models.data ?? []).map(m => ({ value: String(m.id), label: m.name })),
      matches: (row, value) => {
        const part = partMap.get(row.partId) as (typeof partMap extends Map<number, infer T> ? T & { deviceModelIds?: number[]; deviceModelId?: number } : never) | undefined
        if (!part) return false
        const ids = part.deviceModelIds && part.deviceModelIds.length ? part.deviceModelIds : part.deviceModelId ? [part.deviceModelId] : []
        return ids.length === 0 || ids.includes(Number(value))
      },
    },
    { key: 'stock', label: 'Tình trạng', value: stockFilter, onChange: setStockFilter, options: [{ value: 'available', label: 'Còn hàng' }, { value: 'empty', label: 'Hết hàng' }], matches: (row, value) => (value === 'available' ? row.quantity > 0 : row.quantity === 0) },
  ]

  // --- Columns cho Bảng Lịch Sử ---
  const historyColumns: DataColumn<InventoryTransactionRecord>[] = [
    {
      key: 'code',
      label: 'Mã kho',
      render: row => <strong style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{inventoryTransactionCode(row)}</strong>,
    },
    {
      key: 'type',
      label: 'Loại',
      render: row => (
        <StatusBadge
          label={inventoryTransactionLabels[row.transactionType] ?? row.transactionType}
          tone={row.transactionType === 'STOCK_IN' ? 'success' : row.transactionType === 'STOCK_OUT' ? 'warning' : 'neutral'}
        />
      ),
    },
    {
      key: 'branch',
      label: 'Chi nhánh',
      render: row => {
        const name = row.sourceBranchId && row.destinationBranchId
          ? `${branchMap.get(row.sourceBranchId)?.name ?? `#${row.sourceBranchId}`} → ${branchMap.get(row.destinationBranchId)?.name ?? `#${row.destinationBranchId}`}`
          : branchMap.get(row.destinationBranchId ?? row.sourceBranchId ?? -1)?.name ?? 'Hệ thống'
        return <span style={{ whiteSpace: 'nowrap' }}>{name}</span>
      },
    },
    {
      key: 'part',
      label: 'Linh kiện',
      render: row => {
        const part = partMap.get(row.partId)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
            <strong>{part?.name ?? `#${row.partId}`}</strong>
            <small style={{ color: '#64748b', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{part?.partCode}</small>
          </div>
        )
      },
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      render: row => <strong>{row.quantity}</strong>,
    },
    {
      key: 'price',
      label: 'Đơn giá / Thành tiền',
      render: row => {
        const costOne = row.costPrice ?? row.cost_price
        if (!costOne) return <span className="muted-text">—</span>
        const totalCost = costOne * row.quantity
        return (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div>{formatVND(costOne)}</div>
            <small className="muted-text">Tổng: {formatVND(totalCost)}</small>
          </div>
        )
      },
    },
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: row => {
        const supplierName = row.supplierName ?? row.supplier_name
        return supplierName ? <span style={{ whiteSpace: 'nowrap' }}>{supplierName}</span> : <span className="muted-text">—</span>
      },
    },
    {
      key: 'createdAt',
      label: 'Thời điểm',
      render: row => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'recordedBy',
      label: 'Người tạo',
      render: row => <span style={{ whiteSpace: 'nowrap' }}>{row.recordedByName ?? row.recorded_by_name ?? 'Hệ thống'}</span>,
    },
    {
      key: 'note',
      label: 'Ghi chú',
      render: row => (
        <span className="muted-text">
          {row.lotCode ? `Mã lô: ${row.lotCode}` : row.partUsageId ? `Sửa chữa #${row.partUsageId}` : row.note || '—'}
          {row.note && (row.lotCode || row.partUsageId) ? ` · ${row.note}` : ''}
        </span>
      ),
    },
  ]

  const totalQuantity = (inventories.data ?? []).reduce((sum, item) => sum + item.quantity, 0)
  const historyList = (history.data ?? []) as unknown as InventoryTransactionRecord[]

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Kho linh kiện</span>
          <h1>Quản lý tồn kho linh kiện</h1>
          <p>Tồn có thể sử dụng chỉ thay đổi qua giao dịch nhập, xuất, chuyển kho hoặc sử dụng thực tế.</p>
        </div>
        <div className="page-action-group">
          <button className="button button--quiet" disabled={downloadTemplate.isPending} onClick={() => downloadTemplate.mutate()}>
            {downloadTemplate.isPending ? 'Đang tạo mẫu…' : 'Tải mẫu Excel'}
          </button>
          <button className="button button--secondary" disabled={importExcel.isPending} onClick={() => excelInput.current?.click()}>
            {importExcel.isPending ? 'Đang kiểm tra…' : 'Nhập kho từ Excel'}
          </button>
          <input
            ref={excelInput}
            className="visually-hidden"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) importExcel.mutate(file)
            }}
          />
          <button
            className="button button--primary"
            onClick={() => {
              setBranchId(undefined)
              handlePartChange(undefined)
              handleActionTypeChange('STOCK_IN')
              setIsRowAdjustMode(false)
              setUnitPrice('')
              setTotalPrice('')
              setSupplier('')
              setNote('')
              setShowAdjustment(true)
            }}
          >
            Tạo giao dịch kho
          </button>
        </div>
      </header>

      {(downloadTemplate.isError || importExcel.isError) && (
        <ErrorState error={downloadTemplate.error ?? importExcel.error} description="File chưa được xử lý. Kiểm tra thông báo lỗi và thử lại." />
      )}

      <div className="metric-strip">
        <div>
          <span>Dòng tồn kho</span>
          <strong>{inventories.data?.length ?? 0}</strong>
        </div>
        <div>
          <span>Tổng số lượng</span>
          <strong>{totalQuantity}</strong>
        </div>
        <div>
          <span>Linh kiện có tồn</span>
          <strong>{new Set((inventories.data ?? []).filter(item => item.quantity > 0).map(item => item.partId)).size}</strong>
        </div>
      </div>

      {inventories.isLoading || branches.isLoading || parts.isLoading ? (
        <LoadingState />
      ) : inventories.isError || branches.isError || parts.isError ? (
        <ErrorState error={inventories.error ?? branches.error ?? parts.error} retry={() => { inventories.refetch(); branches.refetch(); parts.refetch() }} />
      ) : (
        <AdminDataTable
          rows={inventories.data ?? []}
          rowKey={row => row.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Nhập tên linh kiện, mã, hãng, phân loại hoặc dòng máy"
          searchableText={row => {
            const part = partMap.get(row.partId)
            const modelsText = getPartModelsText(row.partId)
            return `${branchMap.get(row.branchId)?.name ?? ''} ${part?.name ?? ''} ${part?.partCode ?? ''} ${part?.brand ?? ''} ${part?.variant ?? ''} ${modelsText}`
          }}
          sortOptions={[
            { value: 'part-asc', label: 'Linh kiện A–Z', compare: (a, _b) => compareText(partMap.get(a.partId)?.name ?? '', partMap.get(_b.partId)?.name ?? '') },
            { value: 'quantity-desc', label: 'Số lượng giảm dần', compare: (a, _b) => _b.quantity - a.quantity },
            { value: 'quantity-asc', label: 'Số lượng tăng dần', compare: (a, _b) => a.quantity - _b.quantity },
          ]}
        />
      )}

      {/* --- DRAWER FORM TẠO / ĐIỀU CHỈNH GIAO DỊCH KHO --- */}
      {showAdjustment && (
        <DetailDrawer
          eyebrow="Vận hành tồn kho"
          title={isRowAdjustMode ? "Điều chỉnh tồn kho" : "Tạo giao dịch kho"}
          onClose={() => setShowAdjustment(false)}
          footer={<button className="button button--quiet" onClick={() => setShowAdjustment(false)}>Đóng</button>}
        >
          <div className="drawer-form">
            <div className="segmented" style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className={actionType === 'STOCK_IN' ? 'active' : ''}
                onClick={() => handleActionTypeChange('STOCK_IN')}
              >
                Nhập kho
              </button>
              <button
                type="button"
                className={actionType === 'STOCK_OUT' ? 'active' : ''}
                onClick={() => handleActionTypeChange('STOCK_OUT')}
              >
                Xuất kho
              </button>
              <button
                type="button"
                className={actionType === 'TRANSFER' ? 'active' : ''}
                onClick={() => handleActionTypeChange('TRANSFER')}
              >
                Chuyển kho
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">
                  <b>
                    {actionType === 'TRANSFER' ? 'Chi nhánh xuất' : 'Chi nhánh'}
                    <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                  </b>
                </span>
                <select value={branchId ?? ''} onChange={e => setBranchId(Number(e.target.value))}>
                  <option value="">Chọn chi nhánh</option>
                  {branches.data?.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              {actionType === 'TRANSFER' && (
                <label className="field">
                  <span className="field-label">
                    <b>
                      Chi nhánh nhận
                      <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                    </b>
                  </span>
                  <select value={destinationBranchId ?? ''} onChange={e => setDestinationBranchId(Number(e.target.value))}>
                    <option value="">Chọn chi nhánh nhận</option>
                    {branches.data?.filter(b => b.id !== branchId).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Select linh kiện gom nhóm chuẩn hoá */}
            <label className="field">
              <span className="field-label">
                <b>
                  Linh kiện
                  <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                </b>
              </span>
              <select value={partId ?? ''} onChange={e => handlePartChange(Number(e.target.value) || undefined)}>
                <option value="">Chọn linh kiện</option>
                {groupedParts.map(group => (
                  <optgroup key={group.brand} label={`── HÃNG ${group.brand.toUpperCase()} ──`}>
                    {group.items.map(p => (
                      <option key={p.id} value={p.id}>
                        {formatPartOptionLabel(p.id)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {inventory.isLoading ? (
              <LoadingState />
            ) : (
              branchId && partId && (
                <div className="inventory-current" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Tồn kho hiện tại:</span>
                  <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{inventory.data?.quantity ?? 0} chiếc</strong>
                </div>
              )
            )}

            {/* --- NHẬP KHO FORM --- */}
            {actionType === 'STOCK_IN' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Nhập kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Mã nhập kho
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input placeholder="Nhập mã nhập kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Số lượng
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input type="number" min="1" value={quantity} onChange={e => handleQuantityChange(Number(e.target.value))} />
                  </label>

                  <label className="field">
                    <span className="field-label">
                      <b>
                        Thời gian nhận
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input type="datetime-local" max={businessDateTimeInput()} value={receivedAt} onChange={e => setReceivedAt(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>Nhà cung cấp</b>
                    </span>
                    <input placeholder="VD: Đinh Hiếu Mobile" value={supplier} onChange={e => setSupplier(e.target.value)} />
                  </label>

                  {!isRowAdjustMode && (
                    <>
                      <label className="field">
                        <span className="field-label">
                          <b>Đơn giá nhập (VNĐ)</b>
                        </span>
                        <input
                          type="number"
                          placeholder="Nhập giá 1 chiếc"
                          value={unitPrice}
                          onChange={e => handleUnitPriceChange(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">
                          <b>Thành tiền (VNĐ)</b>
                        </span>
                        <input
                          type="number"
                          placeholder="Tự động nhân số lượng"
                          value={totalPrice}
                          onChange={e => handleTotalPriceChange(e.target.value)}
                          style={{ fontWeight: 600, color: '#1e40af' }}
                        />
                      </label>
                    </>
                  )}
                </div>

                {!isRowAdjustMode && unitPrice && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', fontSize: '0.8125rem', color: '#1e40af' }}>
                    Chi tiết: <strong>{quantity}</strong> × <strong>{formatVND(Number(unitPrice))}</strong> = <strong>{formatVND(Number(totalPrice))}</strong>
                  </div>
                )}

                <label className="field" style={{ marginTop: '12px' }}>
                  <span className="field-label">
                    <b>Ghi chú</b>
                  </span>
                  <input placeholder="Nhập ghi chú (không bắt buộc)" value={note} onChange={e => setNote(e.target.value)} />
                </label>

                <button
                  className="button button--primary"
                  disabled={!branchId || !partId || quantity < 1 || !lotCode.trim() || !receivedAt || stockIn.isPending}
                  onClick={() => stockIn.mutate()}
                  style={{ marginTop: '16px', width: '100%' }}
                >
                  {stockIn.isPending ? 'Đang lưu...' : 'Ghi nhận nhập kho'}
                </button>
              </section>
            )}

            {/* --- XUẤT KHO FORM --- */}
            {actionType === 'STOCK_OUT' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Xuất kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Mã xuất kho
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input placeholder="Nhập mã xuất kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Số lượng xuất
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: '12px' }}>
                  <span className="field-label">
                    <b>
                      Lý do / Ghi chú xuất kho
                      <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                    </b>
                  </span>
                  <input placeholder="Nhập lý do hoặc ghi chú xuất kho" value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button
                  className="button button--secondary"
                  disabled={!branchId || !partId || quantity < 1 || !lotCode.trim() || !note.trim() || stockOut.isPending}
                  onClick={() => stockOut.mutate()}
                  style={{ marginTop: '16px', width: '100%' }}
                >
                  {stockOut.isPending ? 'Đang lưu...' : 'Ghi nhận xuất kho'}
                </button>
              </section>
            )}

            {/* --- CHUYỂN KHO FORM --- */}
            {actionType === 'TRANSFER' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Chuyển kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Mã chuyển kho
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input placeholder="Nhập mã chuyển kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>
                        Số lượng chuyển
                        <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </b>
                    </span>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: '12px' }}>
                  <span className="field-label">
                    <b>Ghi chú chuyển kho</b>
                  </span>
                  <input placeholder="Nhập ghi chú" value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button
                  className="button button--secondary"
                  disabled={!branchId || !destinationBranchId || !partId || quantity < 1 || !lotCode.trim() || transfer.isPending}
                  onClick={() => transfer.mutate()}
                  style={{ marginTop: '16px', width: '100%' }}
                >
                  {transfer.isPending ? 'Đang lưu...' : 'Ghi nhận chuyển kho'}
                </button>
              </section>
            )}

            {(inventory.isError || stockIn.isError || stockOut.isError || transfer.isError) && (
              <ErrorState error={stockIn.error ?? stockOut.error ?? transfer.error ?? inventory.error} />
            )}

            {/* Lịch sử giao dịch nhanh của linh kiện được chọn */}
            {partId && (
              <section className="detail-section" style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '10px' }}>Lịch sử giao dịch gần đây của linh kiện</h3>
                {transactions.isLoading ? (
                  <LoadingState />
                ) : !transactions.data?.length ? (
                  <p className="muted-text" style={{ fontSize: '0.8125rem' }}>Chưa có giao dịch kho nào cho linh kiện này.</p>
                ) : (
                  <ol className="inventory-ledger" style={{ fontSize: '0.8125rem' }}>
                    {(transactions.data as unknown as InventoryTransactionRecord[]).slice(0, 5).map(row => (
                      <li key={row.id}>
                        <strong>
                          {inventoryTransactionCode(row)} · {inventoryTransactionLabels[row.transactionType]} · {row.quantity} chiếc
                        </strong>
                        <span>
                          {formatDateTime(row.createdAt)} · {row.recordedByName ?? row.recorded_by_name}
                        </span>
                        <small>
                          {row.supplierName || row.supplier_name ? `NCC: ${row.supplierName ?? row.supplier_name} · ` : ''}
                          {row.costPrice || row.cost_price ? `Đơn giá: ${formatVND(row.costPrice ?? row.cost_price)} · ` : ''}
                          {row.note || 'Không có ghi chú'}
                        </small>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </DetailDrawer>
      )}

      {/* --- BẢNG LỊCH SỬ XUẤT NHẬP KHO CHUẨN ĐỒNG BỘ --- */}
      <section className="ops-section ops-section--inventory-history" style={{ marginTop: '32px' }}>
        <div className="ops-section__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NHẬT KÝ VẬN HÀNH</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '2px' }}>Lịch sử xuất nhập kho</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Tra cứu chi tiết mọi biến động kho, đơn giá nhập, nhà cung cấp và thông tin ghi nhận.</p>
          </div>
          <button
            className="button button--secondary"
            onClick={handleExportHistoryCSV}
            style={{ fontSize: '0.8125rem', height: '36px' }}
          >
            Xuất lịch sử (.CSV)
          </button>
        </div>

        {/* Bộ lọc Lịch Sử theo thời gian & Select Linh Kiện Chuẩn */}
        <div className="inventory-history-filters" style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <label className="field">
            <span className="field-label"><b>Mã xuất / nhập kho</b></span>
            <input placeholder="Nhập mã..." value={historyCode} onChange={e => setHistoryCode(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label"><b>Chi nhánh</b></span>
            <select value={historyBranchId} onChange={e => setHistoryBranchId(e.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {branches.data?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label"><b>Linh kiện</b></span>
            <select value={historyPartId} onChange={e => setHistoryPartId(e.target.value)}>
              <option value="">Tất cả linh kiện</option>
              {parts.data?.map(p => (
                <option key={p.id} value={p.id}>
                  {formatPartOptionLabel(p.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label"><b>Loại giao dịch</b></span>
            <select value={historyType} onChange={e => setHistoryType(e.target.value)}>
              <option value="">Tất cả giao dịch</option>
              {Object.entries(inventoryTransactionLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label"><b>Từ ngày</b></span>
            <input type="date" value={historyFrom} max={historyTo || undefined} onChange={e => setHistoryFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label"><b>Đến ngày</b></span>
            <input type="date" value={historyTo} min={historyFrom || undefined} onChange={e => setHistoryTo(e.target.value)} />
          </label>
        </div>

        {history.isLoading ? (
          <LoadingState label="Đang tải lịch sử kho…" />
        ) : history.isError ? (
          <ErrorState error={history.error} retry={() => history.refetch()} />
        ) : (
          <AdminDataTable
            rows={historyList}
            rowKey={row => row.id}
            columns={historyColumns}
            searchPlaceholder="Tìm kiếm nhanh trong lịch sử..."
            searchableText={row => {
              const part = partMap.get(row.partId)
              const supplierName = row.supplierName ?? row.supplier_name ?? ''
              const recordedByName = row.recordedByName ?? row.recorded_by_name ?? ''
              const code = inventoryTransactionCode(row)
              return `${code} ${part?.name ?? ''} ${part?.partCode ?? ''} ${supplierName} ${recordedByName} ${row.note ?? ''}`
            }}
            sortOptions={[
              { value: 'date-desc', label: 'Thời gian mới nhất', compare: (a, _b) => new Date(_b.createdAt).getTime() - new Date(a.createdAt).getTime() },
              { value: 'date-asc', label: 'Thời gian cũ nhất', compare: (a, _b) => new Date(a.createdAt).getTime() - new Date(_b.createdAt).getTime() },
              { value: 'quantity-desc', label: 'Số lượng giảm dần', compare: (a, _b) => _b.quantity - a.quantity },
            ]}
          />
        )}
      </section>

      <DefectiveInventoryPanel />
      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}

export { SlotsPage } from './SlotsPage'
export { SchedulesPage } from './SchedulesPage'