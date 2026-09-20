import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { BranchInventoryResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { formatDateTime, formatMoney } from '../../../utils/format'
import { compareText } from '../../../utils/table'

export function InventoryPage() {
  const client = useQueryClient()
  const [branchId, setBranchId] = useState<number>()
  const [partId, setPartId] = useState<number>()
  const [destinationBranchId, setDestinationBranchId] = useState<number>()
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [toast, setToast] = useState<string>()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal) })
  const inventories = useQuery({ queryKey: ['admin', 'inventories'], queryFn: ({ signal }) => adminApi.inventories({}, signal) })
  const inventory = useQuery({ queryKey: ['admin', 'inventory', branchId, partId], queryFn: ({ signal }) => adminApi.inventory(branchId!, partId!, signal), enabled: Boolean(showAdjustment && branchId && partId), retry: false })
  const branchMap = useMemo(() => new Map(branches.data?.map(item => [item.id, item])), [branches.data])
  const partMap = useMemo(() => new Map(parts.data?.map(item => [item.id, item])), [parts.data])
  const brands = Array.from(new Set((parts.data ?? []).map(item => item.brand).filter((value): value is string => Boolean(value)))).sort(compareText)
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'inventories'] }), client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId, partId] })]) }
  const adjust = useMutation({ mutationFn: (direction: 'stock-in' | 'stock-out') => adminApi.adjustStock(direction, { branchId: branchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: async () => { setToast('Đã cập nhật số lượng tồn kho.'); setNote(''); await refresh() } })
  const transfer = useMutation({ mutationFn: () => adminApi.transferStock({ sourceBranchId: branchId!, destinationBranchId: destinationBranchId!, partId: partId!, quantity, note: note.trim() || undefined }), onSuccess: async () => { setToast('Đã chuyển kho thành công.'); setNote(''); await refresh() } })
  const columns: DataColumn<BranchInventoryResponse>[] = [
    { key: 'branch', label: 'Chi nhánh', render: row => <strong>{branchMap.get(row.branchId)?.name ?? `#${row.branchId}`}</strong> },
    { key: 'part', label: 'Linh kiện', render: row => { const part = partMap.get(row.partId); return <div className="business-cell"><strong>{part?.name ?? `#${row.partId}`}</strong><small>{part?.partCode}</small></div> } },
    { key: 'brand', label: 'Hãng', render: row => partMap.get(row.partId)?.brand ?? 'Chưa xác định' },
    { key: 'variant', label: 'Phiên bản', render: row => partMap.get(row.partId)?.variant ?? 'Tiêu chuẩn' },
    { key: 'quantity', label: 'Số lượng', render: row => <strong className="quantity-cell">{row.quantity}</strong> },
    { key: 'updated', label: 'Cập nhật gần nhất', render: row => formatDateTime(row.updatedAt) },
    { key: 'status', label: 'Tình trạng', render: row => <StatusBadge label={row.quantity > 0 ? 'Còn hàng' : 'Hết hàng'} tone={row.quantity > 0 ? 'success' : 'warning'} /> },
    { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: row => <button className="text-action" onClick={() => { setBranchId(row.branchId); setPartId(row.partId); setDestinationBranchId(undefined); setShowAdjustment(true) }}>Điều chỉnh</button> },
  ]
  const filters: TableFilter<BranchInventoryResponse>[] = [
    { key: 'branch', label: 'Chi nhánh', value: branchFilter, onChange: setBranchFilter, options: (branches.data ?? []).map(item => ({ value: String(item.id), label: item.name })), matches: (row, value) => String(row.branchId) === value },
    { key: 'brand', label: 'Hãng', value: brandFilter, onChange: setBrandFilter, options: brands.map(value => ({ value, label: value })), matches: (row, value) => partMap.get(row.partId)?.brand === value },
    { key: 'stock', label: 'Tình trạng', value: stockFilter, onChange: setStockFilter, options: [{ value: 'available', label: 'Còn hàng' }, { value: 'empty', label: 'Hết hàng' }], matches: (row, value) => value === 'available' ? row.quantity > 0 : row.quantity === 0 },
  ]
  const totalQuantity = (inventories.data ?? []).reduce((sum, item) => sum + item.quantity, 0)

  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Danh mục</span><h1>Quản lý tồn kho linh kiện</h1><p>Theo dõi linh kiện, hãng, phiên bản và số lượng thực tế tại từng địa điểm.</p></div><button className="button button--primary" onClick={() => { setBranchId(undefined); setPartId(undefined); setShowAdjustment(true) }}>Điều chỉnh tồn kho</button></header>
    <div className="metric-strip"><div><span>Dòng tồn kho</span><strong>{inventories.data?.length ?? 0}</strong></div><div><span>Tổng số lượng</span><strong>{totalQuantity}</strong></div><div><span>Linh kiện có tồn</span><strong>{new Set((inventories.data ?? []).filter(item => item.quantity > 0).map(item => item.partId)).size}</strong></div></div>
    {inventories.isLoading || branches.isLoading || parts.isLoading ? <LoadingState /> : inventories.isError || branches.isError || parts.isError ? <ErrorState error={inventories.error ?? branches.error ?? parts.error} retry={() => { inventories.refetch(); branches.refetch(); parts.refetch() }} /> : <AdminDataTable rows={inventories.data ?? []} rowKey={row => row.id} columns={columns} filters={filters} searchPlaceholder="Tìm linh kiện, hãng hoặc phiên bản..." searchableText={row => { const part = partMap.get(row.partId); return `${branchMap.get(row.branchId)?.name ?? ''} ${part?.name ?? ''} ${part?.partCode ?? ''} ${part?.brand ?? ''} ${part?.variant ?? ''}` }} sortOptions={[{ value: 'part-asc', label: 'Linh kiện A–Z', compare: (a, b) => compareText(partMap.get(a.partId)?.name ?? '', partMap.get(b.partId)?.name ?? '') }, { value: 'quantity-desc', label: 'Số lượng giảm dần', compare: (a, b) => b.quantity - a.quantity }, { value: 'quantity-asc', label: 'Số lượng tăng dần', compare: (a, b) => a.quantity - b.quantity }]} />}
    {showAdjustment && <DetailDrawer eyebrow="Vận hành tồn kho" title="Nhập, xuất hoặc chuyển kho" onClose={() => setShowAdjustment(false)} footer={<button className="button button--quiet" onClick={() => setShowAdjustment(false)}>Đóng</button>}><div className="drawer-form"><Picker label="Chi nhánh" value={branchId} onChange={value => { setBranchId(value); setDestinationBranchId(undefined) }} options={branches.data} /><Picker label="Linh kiện" value={partId} onChange={setPartId} options={parts.data?.map(part => ({ ...part, name: `${part.name} · ${part.brand ?? 'Chưa rõ hãng'} · ${part.variant ?? 'Tiêu chuẩn'} · ${formatMoney(part.salePrice)}` }))} />{inventory.isLoading ? <LoadingState /> : branchId && partId && <div className="inventory-current"><span>Tồn hiện tại</span><strong>{inventory.data?.quantity ?? 0}</strong></div>}<div className="form-grid"><label className="field"><span>Số lượng</span><input placeholder="Nhập số lượng" type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><label className="field"><span>Ghi chú <i>Không bắt buộc</i></span><input placeholder="Ví dụ: nhập kho từ nhà cung cấp" value={note} onChange={event => setNote(event.target.value)} /></label></div>{(inventory.isError || adjust.isError || transfer.isError) && <ErrorState error={adjust.error ?? transfer.error ?? inventory.error} />}<div className="button-row"><button className="button button--primary" disabled={!branchId || !partId || quantity < 1 || adjust.isPending} onClick={() => adjust.mutate('stock-in')}>Nhập kho</button><button className="button button--secondary" disabled={!branchId || !partId || quantity < 1 || adjust.isPending} onClick={() => adjust.mutate('stock-out')}>Xuất kho</button></div><section className="detail-section"><h3>Chuyển sang chi nhánh khác</h3><Picker label="Chi nhánh nhận" value={destinationBranchId} onChange={setDestinationBranchId} options={branches.data?.filter(branch => branch.id !== branchId)} /><button className="button button--secondary" disabled={!branchId || !destinationBranchId || !partId || quantity < 1 || transfer.isPending} onClick={() => transfer.mutate()}>Chuyển kho</button></section></div></DetailDrawer>}
    {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
  </div>
}

export { SlotsPage } from './SlotsPage'

export { SchedulesPage } from './SchedulesPage'

function Picker<T extends { id: number; name: string }>({ label, value, onChange, options }: { label: string; value?: number; onChange: (value: number) => void; options?: T[] }) {
  return <label className="field"><span>{label}</span><select value={value ?? ''} onChange={event => onChange(Number(event.target.value))}><option value="">Chọn {label.toLowerCase()}</option>{options?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}
