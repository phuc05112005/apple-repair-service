import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import type {
  BranchInventoryResponse,
  DateOverrideResponse,
  SlotRule,
  TechnicianScheduleResponse,
  TechnicianScheduleStatus,
  UserRole,
  WeeklyScheduleResponse,
} from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { DefectiveInventoryPanel } from '../../../components/DefectiveInventoryPanel'
import { businessDate, businessDateTimeInput, formatDate, formatDateTime, formatTime } from '../../../utils/format'
import { inventoryTransactionCode } from '../../../utils/inventory'
import { cloneSchedule, normalizeTime24, validateSlotRules, validateWeeklySchedules } from '../../../utils/scheduleValidation'
import { compareText } from '../../../utils/table'
import { BulkTechnicianScheduleDrawer } from './BulkTechnicianScheduleDrawer'

// ============================================================================
// 1. INVENTORY PAGE LOGIC & CONSTANTS
// ============================================================================

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

function ExpandableHistoryNote({ row }: { row: InventoryTransactionRecord }) {
  const [expanded, setExpanded] = useState(false)
  const fullText = [
    row.lotCode ? `Mã lô: ${row.lotCode}` : null,
    row.partUsageId ? `Sửa chữa #${row.partUsageId}` : null,
    row.note || null,
  ].filter(Boolean).join(' · ')

  if (!fullText) return <span className="muted-text">—</span>
  if (fullText.length <= 40) return <span className="muted-text">{fullText}</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '260px' }}>
      <span className="muted-text">{expanded ? fullText : `${fullText.slice(0, 40)}...`}</span>
      <button
        type="button"
        className="text-action"
        style={{ fontSize: '0.75rem', padding: 0, textDecoration: 'underline', width: 'fit-content' }}
        onClick={e => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
      >
        {expanded ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}
      </button>
    </div>
  )
}

export function InventoryPage() {
  const client = useQueryClient()
  const location = useLocation()

  const initialPartId = (location.state as { partId?: number } | null)?.partId

  const [activeHistoryTab, setActiveHistoryTab] = useState<'HISTORY' | 'DEFECTIVE'>('HISTORY')

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

  const [branchFilter, setBranchFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')

  const [historyCode, setHistoryCode] = useState('')
  const [historyBranchId, setHistoryBranchId] = useState('')
  const [historyPartId, setHistoryPartId] = useState('')
  const [historyModelId, setHistoryModelId] = useState('')
  const [historySupplier, setHistorySupplier] = useState('')
  const [historyType, setHistoryType] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')

  const [toast, setToast] = useState<string>()
  const excelInput = useRef<HTMLInputElement>(null)

  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal) })
  const models = useQuery({ queryKey: ['admin', 'device-models'], queryFn: ({ signal }) => adminApi.resourceList<{ id: number; name: string }>('device-models', signal) })
  const inventories = useQuery({ queryKey: ['admin', 'inventories'], queryFn: ({ signal }) => adminApi.inventories({}, signal) })
  const inventory = useQuery({ queryKey: ['admin', 'inventory', branchId, partId], queryFn: ({ signal }) => adminApi.inventory(branchId!, partId!, signal), enabled: Boolean(showAdjustment && branchId && partId), retry: false })

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
    enabled: activeHistoryTab === 'HISTORY',
  })

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

  // Chuẩn hóa dữ liệu mảng an toàn hỗ trợ cả Page / Array và thỏa mãn ESLint
  const rawList = useMemo<InventoryTransactionRecord[]>(() => {
    if (!history.data) return []
    if (Array.isArray(history.data)) {
      return history.data as unknown as InventoryTransactionRecord[]
    }
    const pagedData = history.data as unknown as { content?: InventoryTransactionRecord[] }
    return pagedData.content ?? []
  }, [history.data])

  const existingSuppliers = useMemo(() => {
    const set = new Set<string>()
    rawList.forEach(item => {
      const sup = item.supplierName ?? item.supplier_name
      if (sup && sup.trim()) set.add(sup.trim())
    })
    return Array.from(set).sort(compareText)
  }, [rawList])

  const historyList = useMemo(() => {
    let list = rawList

    if (historyModelId) {
      const targetModelId = Number(historyModelId)
      list = list.filter(row => {
        const part = partMap.get(row.partId) as (typeof partMap extends Map<number, infer T> ? T & { deviceModelIds?: number[]; deviceModelId?: number } : never) | undefined
        if (!part) return false
        const ids = part.deviceModelIds && part.deviceModelIds.length ? part.deviceModelIds : part.deviceModelId ? [part.deviceModelId] : []
        return ids.length === 0 || ids.includes(targetModelId)
      })
    }

    if (historySupplier) {
      const low = historySupplier.toLowerCase()
      list = list.filter(row => {
        const supName = (row.supplierName ?? row.supplier_name ?? '').toLowerCase()
        return supName.includes(low)
      })
    }

    return list
  }, [rawList, historyModelId, historySupplier, partMap])

  function getPartModelsText(pId: number) {
    const part = partMap.get(pId) as (typeof partMap extends Map<number, infer T> ? T & { deviceModelIds?: number[]; deviceModelId?: number } : never) | undefined
    if (!part) return 'Chưa xác định'
    const pModelIds = part.deviceModelIds && part.deviceModelIds.length ? part.deviceModelIds : part.deviceModelId ? [part.deviceModelId] : []
    if (!pModelIds.length) return 'Tất cả dòng máy'
    return pModelIds.map(id => modelMap.get(id)).filter(Boolean).join(', ')
  }

  function formatPartOptionLabel(pId: number) {
    const part = partMap.get(pId)
    if (!part) return `#${pId}`
    const modelsText = getPartModelsText(pId)
    const variantText = part.variant ? ` - ${part.variant}` : ''
    const modelInfo = modelsText && modelsText !== 'Chưa xác định' && modelsText !== 'Tất cả dòng máy' ? ` (${modelsText})` : ''
    return `${part.name}${variantText}${modelInfo} [${part.partCode}]`
  }

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

  const handleExportHistoryCSV = () => {
    if (!history.data || rawList.length === 0) {
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

    const historyData = historyList

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
      label: 'Ghi chú / Mã lô',
      render: row => <ExpandableHistoryNote row={row} />,
    },
  ]

  const totalQuantity = (inventories.data ?? []).reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Danh mục</span>
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

      {showAdjustment && (
        <DetailDrawer
          eyebrow="Vận hành tồn kho"
          title={isRowAdjustMode ? "Điều chỉnh tồn kho" : "Tạo giao dịch kho"}
          onClose={() => setShowAdjustment(false)}
          footer={<button className="button button--quiet" onClick={() => setShowAdjustment(false)}>Đóng</button>}
        >
          <div className="drawer-form">
            <div className="segmented" style={{ marginBottom: '16px', display: 'inline-flex', width: 'fit-content' }}>
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

            <label className="field">
              <span className="field-label">
                <b>
                  Linh kiện (Theo Hãng)
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

            {actionType === 'STOCK_IN' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Nhập kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">
                      <b>Mã nhập kho <span style={{ color: '#ef4444' }}>*</span></b>
                    </span>
                    <input placeholder="Nhập mã nhập kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>Số lượng <span style={{ color: '#ef4444' }}>*</span></b>
                    </span>
                    <input type="number" min="1" value={quantity} onChange={e => handleQuantityChange(Number(e.target.value))} />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      <b>Thời gian nhận <span style={{ color: '#ef4444' }}>*</span></b>
                    </span>
                    <input type="datetime-local" max={businessDateTimeInput()} value={receivedAt} onChange={e => setReceivedAt(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label"><b>Nhà cung cấp</b></span>
                    <input placeholder="VD: Đinh Hiếu Mobile" value={supplier} onChange={e => setSupplier(e.target.value)} />
                  </label>

                  {!isRowAdjustMode && (
                    <>
                      <label className="field">
                        <span className="field-label"><b>Đơn giá nhập (VNĐ)</b></span>
                        <input
                          type="number"
                          placeholder="Nhập giá 1 chiếc"
                          value={unitPrice}
                          onChange={e => handleUnitPriceChange(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label"><b>Thành tiền (VNĐ)</b></span>
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
                  <span className="field-label"><b>Ghi chú</b></span>
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

            {actionType === 'STOCK_OUT' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Xuất kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label"><b>Mã xuất kho <span style={{ color: '#ef4444' }}>*</span></b></span>
                    <input placeholder="Nhập mã xuất kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label"><b>Số lượng xuất <span style={{ color: '#ef4444' }}>*</span></b></span>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: '12px' }}>
                  <span className="field-label"><b>Lý do / Ghi chú xuất kho <span style={{ color: '#ef4444' }}>*</span></b></span>
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

            {actionType === 'TRANSFER' && (
              <section className="detail-section" style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Thông tin Chuyển kho</h3>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label"><b>Mã chuyển kho <span style={{ color: '#ef4444' }}>*</span></b></span>
                    <input placeholder="Nhập mã chuyển kho" value={lotCode} onChange={e => setLotCode(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label"><b>Số lượng chuyển <span style={{ color: '#ef4444' }}>*</span></b></span>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: '12px' }}>
                  <span className="field-label"><b>Ghi chú chuyển kho</b></span>
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
          </div>
        </DetailDrawer>
      )}

      <section className="ops-section ops-section--inventory-history" style={{ marginTop: '32px' }}>
        <div className="ops-section__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NHẬT KÝ VẬN HÀNH</span>
            
            <div className="segmented" style={{ display: 'inline-flex', width: 'fit-content', margin: '4px 0' }}>
              <button
                type="button"
                className={activeHistoryTab === 'HISTORY' ? 'active' : ''}
                onClick={() => setActiveHistoryTab('HISTORY')}
              >
                Lịch sử xuất nhập kho
              </button>
              <button
                type="button"
                className={activeHistoryTab === 'DEFECTIVE' ? 'active' : ''}
                onClick={() => setActiveHistoryTab('DEFECTIVE')}
              >
                Linh kiện lỗi
              </button>
            </div>

            {activeHistoryTab === 'HISTORY' ? (
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Tra cứu chi tiết mọi biến động kho, đơn giá nhập, nhà cung cấp và thông tin ghi nhận.
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Kho lỗi được theo dõi riêng. Số lượng này không thể xuất cho dịch vụ và không được cộng vào tồn kho linh kiện tốt.
              </p>
            )}
          </div>

          {activeHistoryTab === 'HISTORY' && (
            <button
              className="button button--secondary"
              onClick={handleExportHistoryCSV}
              style={{ fontSize: '0.8125rem', height: '36px' }}
            >
              Xuất lịch sử (.CSV)
            </button>
          )}
        </div>

        {activeHistoryTab === 'HISTORY' && (
          <div style={{ marginTop: '16px' }}>
            <div className="inventory-history-filters" style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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
                <span className="field-label"><b>Dòng máy tương thích</b></span>
                <select value={historyModelId} onChange={e => setHistoryModelId(e.target.value)}>
                  <option value="">Tất cả dòng máy</option>
                  {models.data?.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label"><b>Linh kiện (Theo Hãng)</b></span>
                <select value={historyPartId} onChange={e => setHistoryPartId(e.target.value)}>
                  <option value="">Tất cả linh kiện</option>
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

              <label className="field">
                <span className="field-label"><b>Nhà cung cấp</b></span>
                <select value={historySupplier} onChange={e => setHistorySupplier(e.target.value)}>
                  <option value="">Tất cả nhà cung cấp</option>
                  {existingSuppliers.map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
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
          </div>
        )}

        {activeHistoryTab === 'DEFECTIVE' && (
          <div style={{ marginTop: '16px' }}>
            <DefectiveInventoryPanel embedded />
          </div>
        )}
      </section>

      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}

// ============================================================================
// 2. SLOTS PAGE LOGIC
// ============================================================================

const days = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']
const newSlot = (): SlotRule => ({ startTime: '09:00', endTime: '10:00', enabled: true })

function Time24Input({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const edit = (raw: string) => {
    let next = raw.replace(/[^\d:]/g, '').slice(0, 5)
    if (!next.includes(':') && next.length > 2) next = `${next.slice(0, 2)}:${next.slice(2)}`
    onChange(next)
  }
  return (
    <input
      className="time-24-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="00:00"
      maxLength={5}
      pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
      title="Nhập giờ theo định dạng 24 giờ, từ 00:00 đến 23:59"
      value={normalizeTime24(value)}
      onChange={event => edit(event.target.value)}
      onBlur={() => onChange(normalizeTime24(value))}
    />
  )
}

function RuleEditor({ slots, onChange, error }: { slots: SlotRule[]; onChange: (slots: SlotRule[]) => void; error?: string | null }) {
  const edit = (index: number, patch: Partial<SlotRule>) => onChange(slots.map((slot, position) => position === index ? { ...slot, ...patch } : slot))
  return (
    <div className="schedule-rules">
      {slots.length === 0 && <div className="empty-inline">Chưa có khung giờ. Hãy thêm khung giờ trước khi lưu.</div>}
      {slots.map((slot, index) => (
        <div className="schedule-rule" key={index}>
          <label className="field"><span>Bắt đầu <i>24 giờ</i></span><Time24Input value={slot.startTime} onChange={value => edit(index, { startTime: value })} /></label>
          <label className="field"><span>Kết thúc <i>24 giờ</i></span><Time24Input value={slot.endTime} onChange={value => edit(index, { endTime: value })} /></label>
          <label className="check-option"><input type="checkbox" checked={slot.enabled} onChange={event => edit(index, { enabled: event.target.checked })} /><span>Đang mở</span></label>
          <button type="button" className="text-action text-action--danger" onClick={() => onChange(slots.filter((_, position) => position !== index))}>Xóa</button>
        </div>
      ))}
      {error && <div className="inline-error" role="alert">{error}</div>}
      <button type="button" className="button button--secondary" onClick={() => onChange([...slots, newSlot()])}>+ Thêm khung giờ</button>
    </div>
  )
}

export function SlotsPage() {
  const client = useQueryClient()
  const [branchId, setBranchId] = useState<number>()
  const [tab, setTab] = useState<'weekly' | 'date'>('weekly')
  const [weekday, setWeekday] = useState(1)
  const [copyTo, setCopyTo] = useState<number[]>([])
  const [date, setDate] = useState(businessDate)
  const [weeklyDrafts, setWeeklyDrafts] = useState<WeeklyScheduleResponse[]>()
  const [mode, setMode] = useState<DateOverrideResponse['mode']>()
  const [dateSlots, setDateSlots] = useState<SlotRule[]>()
  const [toast, setToast] = useState<string>()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const selectedBranch = branchId ?? branches.data?.[0]?.id
  const weekly = useQuery({ queryKey: ['admin', 'weekly-schedules', selectedBranch], queryFn: ({ signal }) => adminApi.weeklySchedules(selectedBranch!, signal), enabled: Boolean(selectedBranch) })
  const override = useQuery({ queryKey: ['admin', 'date-override', selectedBranch, date], queryFn: ({ signal }) => adminApi.dateOverride(selectedBranch!, date, signal), enabled: Boolean(selectedBranch && date) })
  const slots = useQuery({ queryKey: ['admin', 'slots', selectedBranch, date], queryFn: ({ signal }) => adminApi.slots(selectedBranch!, date, signal), enabled: Boolean(selectedBranch && date && tab === 'date') })

  const effectiveWeek = weeklyDrafts ?? weekly.data
  const activeWeek = effectiveWeek?.find(item => item.weekday === weekday)
  const dirty = Boolean(weekly.data && weeklyDrafts && JSON.stringify(weekly.data) !== JSON.stringify(weeklyDrafts))
  const weeklyError = weeklyDrafts ? validateWeeklySchedules(weeklyDrafts) : null
  const activeWeekError = activeWeek?.enabled && activeWeek.slots.length === 0 ? 'Ngày đang mở phải có ít nhất một khung giờ.' : activeWeek ? validateSlotRules(activeWeek.slots) : null
  const day = new Date(`${date}T12:00:00`).getDay() || 7
  const baseSlots = weekly.data?.find(item => item.weekday === day)?.slots ?? []
  const activeMode = mode ?? override.data?.mode ?? 'INHERIT'
  const activeDateSlots = dateSlots ?? (override.data?.mode === 'REPLACE' ? override.data.slots : baseSlots)
  const dateError = activeMode === 'REPLACE' && activeDateSlots.length === 0 ? 'Cần ít nhất một khung giờ thay thế.' : activeMode === 'REPLACE' ? validateSlotRules(activeDateSlots) : null

  const updateDay = (patch: Partial<WeeklyScheduleResponse>) => setWeeklyDrafts(current => (current ?? cloneSchedule(weekly.data ?? [])).map(item => item.weekday === weekday ? { ...item, ...patch } : item))
  const applyToDays = () => {
    if (!activeWeek || copyTo.length === 0) return
    setWeeklyDrafts(current => (current ?? cloneSchedule(weekly.data ?? [])).map(item => copyTo.includes(item.weekday) ? { ...item, enabled: activeWeek.enabled, slots: cloneSchedule(activeWeek.slots) } : item))
    setCopyTo([])
    setToast('Đã sao chép cấu hình. Bạn có thể chỉnh từng ngày trước khi lưu.')
  }
  const saveWeek = useMutation({ mutationFn: () => adminApi.saveWeekdays(weeklyDrafts!), onSuccess: async () => { setWeeklyDrafts(undefined); setToast('Đã lưu toàn bộ lịch tuần.'); await client.invalidateQueries({ queryKey: ['admin', 'weekly-schedules', selectedBranch] }); await client.invalidateQueries({ queryKey: ['admin', 'slots', selectedBranch] }) } })
  const saveDate = useMutation({ mutationFn: () => adminApi.saveDateOverride({ branchId: selectedBranch!, date, mode: activeMode, slots: activeMode === 'REPLACE' ? activeDateSlots : [] }), onSuccess: async () => { setMode(undefined); setDateSlots(undefined); setToast('Đã lưu điều chỉnh ngày.'); await client.invalidateQueries({ queryKey: ['admin', 'date-override', selectedBranch, date] }); await client.invalidateQueries({ queryKey: ['admin', 'slots', selectedBranch, date] }) } })

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header"><div><span className="eyebrow">Danh mục</span><h1>Quản lý khung giờ & lịch hẹn</h1><p>Cấu hình nhiều khung giờ cho từng ngày và kiểm tra lịch thực tế theo chi nhánh.</p></div></header>
      <div className="context-filters"><label className="field"><span>Chi nhánh</span><select value={selectedBranch ?? ''} onChange={event => { setBranchId(Number(event.target.value)); setWeeklyDrafts(undefined); setMode(undefined); setDateSlots(undefined) }}>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
      <div className="segmented" role="tablist" aria-label="Cấu hình khung giờ"><button role="tab" aria-selected={tab === 'weekly'} className={tab === 'weekly' ? 'active' : ''} onClick={() => setTab('weekly')}>Lịch lặp theo tuần</button><button role="tab" aria-selected={tab === 'date'} className={tab === 'date' ? 'active' : ''} onClick={() => setTab('date')}>Điều chỉnh theo ngày</button></div>
      {branches.isLoading || weekly.isLoading ? <LoadingState /> : branches.isError || weekly.isError ? <ErrorState error={branches.error ?? weekly.error} retry={() => { branches.refetch(); weekly.refetch() }} /> : tab === 'weekly' && activeWeek ? <section className="ops-section">
        <div className="ops-section__title"><span>01</span><h2>Khung giờ hằng tuần</h2></div>
        <div className="weekday-tabs">{days.map((label, index) => { const draft = effectiveWeek?.find(item => item.weekday === index + 1); return <button type="button" key={label} className={weekday === index + 1 ? 'active' : ''} onClick={() => { setWeekday(index + 1); setCopyTo([]) }}>{label}<small>{draft?.enabled ? `${draft.slots.filter(slot => slot.enabled).length} khung` : 'Đã tắt'}</small></button> })}</div>
        <label className="check-option"><input type="checkbox" checked={activeWeek.enabled} onChange={event => updateDay({ enabled: event.target.checked })} /><span>Mở lịch cho {days[weekday - 1].toLowerCase()}</span></label>
        <RuleEditor slots={activeWeek.slots} onChange={rules => updateDay({ slots: rules })} error={activeWeekError} />
        <div className="schedule-copy"><strong>Áp dụng cấu hình này cho ngày khác</strong><p>Sao chép toàn bộ khung giờ và trạng thái mở, sau đó vẫn có thể chỉnh riêng từng ngày.</p><div>{days.map((label, index) => index + 1 === weekday ? null : <label key={label} className="check-option"><input type="checkbox" checked={copyTo.includes(index + 1)} onChange={event => setCopyTo(value => event.target.checked ? [...value, index + 1] : value.filter(dayValue => dayValue !== index + 1))} /><span>{label}</span></label>)}</div><button type="button" className="button button--secondary" disabled={copyTo.length === 0} onClick={applyToDays}>Áp dụng cho {copyTo.length} ngày</button></div>
        {weeklyError && <div className="inline-error" role="alert">{weeklyError}</div>}
        {!dirty && <p className="form-hint">Chưa có thay đổi cần lưu.</p>}
        <button className="button button--primary" disabled={!dirty || saveWeek.isPending || Boolean(weeklyError)} onClick={() => saveWeek.mutate()}>{saveWeek.isPending ? 'Đang lưu…' : 'Lưu lịch tuần'}</button>
        {saveWeek.isError && <ErrorState error={saveWeek.error} />}
      </section> : tab === 'date' ? <section className="ops-section">
        <div className="ops-section__title"><span>02</span><h2>Điều chỉnh riêng một ngày</h2></div><label className="field"><span>Ngày cần điều chỉnh</span><input type="date" value={date} onChange={event => { setDate(event.target.value); setMode(undefined); setDateSlots(undefined) }} /></label>
        {override.isLoading ? <LoadingState /> : override.isError ? <ErrorState error={override.error} retry={() => override.refetch()} /> : <><label className="field"><span>Áp dụng</span><select value={activeMode} onChange={event => setMode(event.target.value as DateOverrideResponse['mode'])}><option value="INHERIT">Theo lịch tuần</option><option value="DISABLED">Đóng cả ngày</option><option value="REPLACE">Thay khung giờ riêng cho ngày này</option></select></label>{activeMode === 'REPLACE' && <RuleEditor slots={activeDateSlots} onChange={setDateSlots} error={dateError} />}<button className="button button--primary" disabled={saveDate.isPending || Boolean(dateError)} onClick={() => saveDate.mutate()}>{saveDate.isPending ? 'Đang lưu…' : 'Lưu điều chỉnh ngày'}</button>{saveDate.isError && <ErrorState error={saveDate.error} />}</>}
        <div className="detail-section"><h3>Khung giờ thực tế · {formatDate(date)}</h3>{slots.isLoading ? <LoadingState /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : slots.data?.length ? <div className="appointment-list">{slots.data.map(slot => <article key={slot.slotId}><strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong><span>{slot.activeBookingCount} lượt đã đặt</span><StatusBadge label={slot.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'} tone={slot.status === 'OPEN' ? 'success' : 'warning'} /></article>)}</div> : <p>Chưa có khung giờ trong ngày đã chọn.</p>}</div>
      </section> : null}
      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}

// ============================================================================
// 3. SCHEDULES PAGE LOGIC
// ============================================================================

type StaffRole = Extract<UserRole, 'RECEPTIONIST' | 'TECHNICIAN'>
const today = () => businessDate()
const statusLabels: Record<TechnicianScheduleStatus, string> = { WORKING: 'Làm việc', OFF: 'Nghỉ', CANCELLED: 'Đã hủy' }

export function SchedulesPage() {
  const client = useQueryClient()
  const [role, setRole] = useState<StaffRole>('TECHNICIAN')
  const [employeeId, setEmployeeId] = useState<number>()
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<TechnicianScheduleResponse>()
  const [deleting, setDeleting] = useState<TechnicianScheduleResponse>()
  const [showForm, setShowForm] = useState(false)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [branchId, setBranchId] = useState<number>()
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [shiftStatus, setShiftStatus] = useState<TechnicianScheduleStatus>('WORKING')
  const [toast, setToast] = useState<string>()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: ({ signal }) => adminApi.users(signal) })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const employees = useMemo(() => (users.data ?? []).filter(user => user.role === role), [users.data, role])
  const visibleEmployees = employees.filter(user => `${user.fullName} ${user.username}`.toLocaleLowerCase('vi').includes(employeeSearch.toLocaleLowerCase('vi')))
  const selectedId = visibleEmployees.some(user => user.id === employeeId) ? employeeId : visibleEmployees[0]?.id
  const employee = employees.find(user => user.id === selectedId)
  const shifts = useQuery({ queryKey: ['admin', 'schedules', selectedId, date], queryFn: ({ signal }) => adminApi.schedules(selectedId!, date, signal), enabled: Boolean(selectedId && date) })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'schedules', selectedId, date] })
  const save = useMutation({ mutationFn: () => adminApi.saveSchedule(editing?.id, { technicianId: selectedId!, branchId: branchId!, workDate: date, startTime, endTime, status: shiftStatus }), onSuccess: async () => { setShowForm(false); setEditing(undefined); setToast('Đã lưu ca làm.'); await refresh() } })
  const remove = useMutation({ mutationFn: (id: number) => adminApi.deleteSchedule(id), onSuccess: async () => { setDeleting(undefined); setToast('Đã xóa dữ liệu thành công.'); await refresh() } })
  const branchNames = useMemo(() => new Map(branches.data?.map(branch => [branch.id, branch.name])), [branches.data])
  const columns: DataColumn<TechnicianScheduleResponse>[] = [
    { key: 'employee', label: 'Nhân viên', render: () => <strong>{employee?.fullName ?? '—'}</strong> },
    { key: 'branch', label: 'Chi nhánh', render: shift => branchNames.get(shift.branchId) ?? `#${shift.branchId}` },
    { key: 'date', label: 'Ngày', render: shift => formatDate(shift.workDate) },
    { key: 'time', label: 'Ca làm', render: shift => <strong>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</strong> },
    { key: 'status', label: 'Trạng thái', render: shift => <StatusBadge label={statusLabels[shift.status]} tone={shift.status === 'WORKING' ? 'success' : 'warning'} /> },
    { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: shift => <div className="row-actions"><button className="text-action" onClick={() => { setEditing(shift); setBranchId(shift.branchId); setStartTime(shift.startTime.slice(0, 5)); setEndTime(shift.endTime.slice(0, 5)); setShiftStatus(shift.status); setShowForm(true) }}>Sửa</button><button className="text-action text-action--danger" onClick={() => setDeleting(shift)}>Xóa</button></div> },
  ]
  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header"><div><span className="eyebrow">Nhân sự</span><h1>Quản lý lịch làm việc</h1><p>Chọn ngày và ca trước, sau đó xếp lịch cho nhiều kỹ thuật viên trong một lần lưu.</p></div><div className="row-actions"><button className="button button--secondary" disabled={!selectedId || employee?.status !== 'ACTIVE'} onClick={() => { setEditing(undefined); setBranchId(branches.data?.[0]?.id); setStartTime('08:00'); setEndTime('17:00'); setShiftStatus('WORKING'); setShowForm(true) }}>Thêm ca riêng lẻ</button><button className="button button--primary" onClick={() => setShowBatchForm(true)}>+ Xếp lịch nhiều KTV</button></div></header>
      <div className="context-filters"><label className="field"><span>Vai trò nhân viên</span><select value={role} onChange={event => { setRole(event.target.value as StaffRole); setEmployeeId(undefined); setEmployeeSearch('') }}><option value="RECEPTIONIST">Nhân viên tiếp nhận</option><option value="TECHNICIAN">Kỹ thuật viên</option></select></label><label className="field"><span>Tìm nhân viên</span><input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Nhập tên hoặc tài khoản nhân viên" /></label><label className="field"><span>Nhân viên</span><select value={visibleEmployees.some(user => user.id === selectedId) ? selectedId : ''} onChange={event => setEmployeeId(Number(event.target.value))}><option value="">Chọn nhân viên</option>{visibleEmployees.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}</select></label><label className="field"><span>Ngày</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
      {users.isLoading || branches.isLoading ? <LoadingState /> : users.isError || branches.isError ? <ErrorState error={users.error ?? branches.error} retry={() => { users.refetch(); branches.refetch() }} /> : !selectedId ? <p>Không tìm thấy nhân viên thuộc vai trò này.</p> : shifts.isLoading ? <LoadingState /> : shifts.isError ? <ErrorState error={shifts.error} retry={() => shifts.refetch()} /> : <AdminDataTable rows={shifts.data ?? []} rowKey={shift => shift.id} columns={columns} searchPlaceholder="Nhập chi nhánh hoặc giờ làm" searchableText={shift => `${employee?.fullName ?? ''} ${branchNames.get(shift.branchId) ?? ''} ${shift.startTime} ${shift.endTime}`} emptyText="Chưa có lịch làm trong ngày đã chọn." />}
      {showForm && <DetailDrawer eyebrow={editing ? 'Chỉnh sửa ca' : 'Ca làm mới'} title={employee?.fullName ?? 'Nhân viên'} onClose={() => setShowForm(false)} footer={<><button className="button button--quiet" onClick={() => setShowForm(false)}>Hủy</button><button className="button button--primary" disabled={!selectedId || employee?.status !== 'ACTIVE' || !branchId || !startTime || !endTime || startTime >= endTime || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu ca làm'}</button></>}><div className="form-grid drawer-form"><label className="field"><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value))}><option value="">Chọn chi nhánh</option>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label><label className="field"><span>Trạng thái ca</span><select value={shiftStatus} onChange={event => setShiftStatus(event.target.value as TechnicianScheduleStatus)}><option value="WORKING">Làm việc</option><option value="OFF">Nghỉ</option><option value="CANCELLED">Đã hủy</option></select></label></div>{save.isError && <ErrorState error={save.error} />}</DetailDrawer>}
      {showBatchForm && branches.data && users.data && <BulkTechnicianScheduleDrawer date={date} branches={branches.data} users={users.data} onClose={() => setShowBatchForm(false)} onSaved={async () => { await client.invalidateQueries({ queryKey: ['admin', 'schedules'] }) }} />}
      {deleting && <ConfirmDialog title="Xóa ca làm?" busy={remove.isPending} onCancel={() => setDeleting(undefined)} onConfirm={() => remove.mutate(deleting.id)}><p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được sử dụng trong hệ thống.</p><strong>{employee?.fullName} · {formatTime(deleting.startTime)}–{formatTime(deleting.endTime)}</strong>{remove.isError && <ErrorState error={remove.error} />}</ConfirmDialog>}
      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </div>
  )
}