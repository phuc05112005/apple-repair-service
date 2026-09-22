import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActiveStatus, DeviceModelResponse, DeviceTypeResponse, PartResponse, ServiceCatalogItemResponse, ServiceIssueResponse, ServiceTypeCode, ServiceTypeResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { ApiError } from '../../../api/client'
import { AdminDataTable, type DataColumn, type SortOption, type TableFilter } from '../../../components/AdminDataTable'
import { ConfirmDialog, DetailDrawer } from '../../../components/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { formatDateTime, formatMoney } from '../../../utils/format'
import { compareText } from '../../../utils/table'

type Resource = 'branches' | 'device-types' | 'device-models' | 'service-issues' | 'service-types' | 'service-catalog-items' | 'parts'
interface Row {
  id: number
  name?: string
  status: ActiveStatus
  address?: string
  phone?: string | null
  deviceTypeId?: number
  deviceTypeIds?: number[]
  code?: ServiceTypeCode
  deviceModelId?: number
  serviceIssueId?: number
  serviceTypeId?: number
  partId?: number | null
  configuredPrice?: number | null
  standardDurationMinutes?: number | null
  warrantyDays?: number
  partCode?: string
  brand?: string | null
  variant?: string | null
  salePrice?: number
  createdAt?: string
  updatedAt?: string
}

const labels: Record<Resource, string> = { branches: 'Quản lý chi nhánh', 'device-types': 'Loại thiết bị', 'device-models': 'Model thiết bị', 'service-issues': 'Vấn đề dịch vụ', 'service-types': 'Loại dịch vụ', 'service-catalog-items': 'Danh mục dịch vụ', parts: 'Linh kiện' }
const descriptions: Record<Resource, string> = {
  branches: 'Theo dõi địa điểm tiếp nhận, thông tin liên hệ và trạng thái hoạt động của từng chi nhánh.',
  'device-types': 'Quản lý các nhóm thiết bị được hệ thống hỗ trợ.',
  'device-models': 'Gắn từng model với đúng loại thiết bị.',
  'service-issues': 'Quản lý các vấn đề khách hàng có thể lựa chọn.',
  'service-types': 'Quản lý ý nghĩa nghiệp vụ của từng loại dịch vụ.',
  'service-catalog-items': 'Liên kết model, vấn đề, loại dịch vụ, linh kiện, giá và bảo hành.',
  parts: 'Thông tin linh kiện, hãng, phiên bản, giá và tình trạng sử dụng.',
}
const catalogResources: Resource[] = ['device-types', 'device-models', 'service-issues', 'service-types', 'service-catalog-items']
const serviceTypeLabels: Record<ServiceTypeCode, string> = { REPAIR: 'Sửa chữa', REPLACEMENT: 'Thay thế linh kiện', WARRANTY: 'Bảo hành' }
const emptyForm = { warrantyDays: '0' }

export function MasterDataPage({ initial, grouped = false }: { initial: Resource; grouped?: boolean }) {
  const client = useQueryClient()
  const [resource, setResource] = useState<Resource>(initial)
  const [editing, setEditing] = useState<Row>()
  const [detail, setDetail] = useState<Row>()
  const [deleting, setDeleting] = useState<Row>()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' }>()
  useEffect(() => {
    setResource(initial); setEditing(undefined); setDetail(undefined); setDeleting(undefined)
    setShowForm(false); setForm(emptyForm); setStatusFilter(''); setTypeFilter(''); setServiceTypeFilter(''); setBrandFilter('')
  }, [initial])

  const rows = useQuery({ queryKey: ['admin', resource], queryFn: ({ signal }) => adminApi.resourceList<Row>(resource, signal) })
  const needCatalogLookups = resource === 'service-catalog-items' || resource === 'parts'
  const deviceTypes = useQuery({ queryKey: ['admin', 'device-types'], queryFn: ({ signal }) => adminApi.resourceList<DeviceTypeResponse>('device-types', signal), enabled: resource === 'device-models' || resource === 'service-issues' || needCatalogLookups })
  const models = useQuery({ queryKey: ['admin', 'device-models'], queryFn: ({ signal }) => adminApi.resourceList<DeviceModelResponse>('device-models', signal), enabled: needCatalogLookups })
  const issues = useQuery({ queryKey: ['admin', 'service-issues'], queryFn: ({ signal }) => adminApi.resourceList<ServiceIssueResponse>('service-issues', signal), enabled: needCatalogLookups })
  const serviceTypes = useQuery({ queryKey: ['admin', 'service-types'], queryFn: ({ signal }) => adminApi.resourceList<ServiceTypeResponse>('service-types', signal), enabled: needCatalogLookups })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.resourceList<PartResponse>('parts', signal), enabled: resource === 'service-catalog-items' })
  const catalogItems = useQuery({ queryKey: ['admin', 'service-catalog-items'], queryFn: ({ signal }) => adminApi.resourceList<ServiceCatalogItemResponse>('service-catalog-items', signal), enabled: resource === 'parts' })
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal), enabled: resource === 'parts' && Boolean(detail) })
  const inventories = useQuery({ queryKey: ['admin', 'inventory', 'part', detail?.id], queryFn: ({ signal }) => adminApi.inventories({ partId: detail!.id }, signal), enabled: resource === 'parts' && Boolean(detail) })
  const transactions = useQuery({ queryKey: ['admin', 'inventory-transactions', detail?.id], queryFn: ({ signal }) => adminApi.inventoryTransactions(detail!.id, signal), enabled: resource === 'parts' && Boolean(detail) })

  const typeNames = useMemo(() => new Map(deviceTypes.data?.map(item => [item.id, item.name])), [deviceTypes.data])
  const modelMap = useMemo(() => new Map(models.data?.map(item => [item.id, item])), [models.data])
  const issueNames = useMemo(() => new Map(issues.data?.map(item => [item.id, item.name])), [issues.data])
  const serviceTypeMap = useMemo(() => new Map(serviceTypes.data?.map(item => [item.id, item])), [serviceTypes.data])
  const partMap = useMemo(() => new Map(parts.data?.map(item => [item.id, item])), [parts.data])
  const branchNames = useMemo(() => new Map(branches.data?.map(item => [item.id, item.name])), [branches.data])

  function payload() {
    if (resource === 'service-issues') return { name: form.name, deviceTypeIds: (form.deviceTypeIds ?? '').split(',').filter(Boolean).map(Number) }
    if (resource === 'device-models') return { deviceTypeId: Number(form.deviceTypeId), name: form.name }
    if (resource === 'service-types') return { code: form.code, name: form.name }
    if (resource === 'service-catalog-items') return { deviceModelId: Number(form.deviceModelId), serviceTypeId: Number(form.serviceTypeId), serviceIssueId: Number(form.serviceIssueId), partId: form.partId ? Number(form.partId) : null, name: form.name, configuredPrice: form.configuredPrice ? Number(form.configuredPrice) : null, standardDurationMinutes: form.standardDurationMinutes ? Number(form.standardDurationMinutes) : null, warrantyDays: Number(form.warrantyDays || 0) }
    if (resource === 'parts') return { partCode: form.partCode, name: form.name, brand: form.brand || null, variant: form.variant || null, salePrice: Number(form.salePrice) }
    if (resource === 'branches') return { name: form.name, address: form.address, phone: form.phone || null }
    return { name: form.name }
  }
  const save = useMutation({
    mutationFn: () => editing ? adminApi.resourceUpdate<Row>(resource, editing.id, payload()) : adminApi.resourceCreate<Row>(resource, payload()),
    onSuccess: async () => { const wasEditing = Boolean(editing); closeForm(); setToast({ message: wasEditing ? 'Đã cập nhật dữ liệu.' : 'Đã thêm dữ liệu mới.', tone: 'success' }); await client.invalidateQueries({ queryKey: ['admin', resource] }) },
  })
  const toggle = useMutation({ mutationFn: (row: Row) => adminApi.resourceStatus<Row>(resource, row.id, row.status !== 'ACTIVE'), onSuccess: async () => { setToast({ message: 'Đã cập nhật trạng thái.', tone: 'success' }); await client.invalidateQueries({ queryKey: ['admin', resource] }) } })
  const remove = useMutation({
    mutationFn: (row: Row) => adminApi.resourceDelete(resource, row.id),
    onSuccess: async (_, row) => { if (editing?.id === row.id) closeForm(); if (detail?.id === row.id) setDetail(undefined); setDeleting(undefined); setToast({ message: 'Đã xóa dữ liệu thành công.', tone: 'success' }); await client.invalidateQueries({ queryKey: ['admin', resource] }) },
    onError: error => setToast({ message: errorMessage(error), tone: 'danger' }),
  })

  function closeForm() { setEditing(undefined); setShowForm(false); setForm(emptyForm); save.reset() }
  function edit(row: Row) { setEditing(row); setShowForm(true); setForm(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]))) }
  function create() { setEditing(undefined); setForm(emptyForm); setShowForm(true) }
  function switchResource(next: Resource) { setResource(next); setEditing(undefined); setDetail(undefined); setDeleting(undefined); setShowForm(false); setForm(emptyForm); setStatusFilter(''); setTypeFilter(''); setServiceTypeFilter(''); setBrandFilter('') }
  function field(key: string, label: string, type = 'text', required = true) { return <label className="field"><span>{label}{!required && <i>Không bắt buộc</i>}</span><input placeholder={`Nhập ${label.toLowerCase()}`} required={required} type={type} value={form[key] ?? ''} onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))} /></label> }
  function select(key: string, label: string, options: { id?: number; value?: string; name: string }[], optional = false) { return <label className="field"><span>{label}{optional && <i>Không bắt buộc</i>}</span><select required={!optional} value={form[key] ?? ''} onChange={event => setForm(value => ({ ...value, [key]: event.target.value, ...(key === "deviceModelId" ? { serviceIssueId: "" } : {}) }))}><option value="">{optional ? 'Không áp dụng' : `Chọn ${label.toLowerCase()}`}</option>{options.map(option => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.name}</option>)}</select></label> }

  const data = rows.data ?? []
  const brands = Array.from(new Set((resource === 'parts' ? data : parts.data ?? []).map(item => item.brand).filter((value): value is string => Boolean(value)))).sort(compareText)
  const columns = buildColumns(resource, { typeNames, modelMap, issueNames, serviceTypeMap, partMap, onDetail: setDetail, onEdit: edit, onDelete: row => { remove.reset(); setDeleting(row) }, onToggle: row => toggle.mutate(row), busy: toggle.isPending || remove.isPending })
  const filters: TableFilter<Row>[] = [{ key: 'status', label: 'Trạng thái', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'ACTIVE', label: 'Đang dùng' }, { value: 'INACTIVE', label: 'Ngừng dùng' }], matches: (row, value) => row.status === value }]
  if (resource === 'device-models' || resource === 'service-catalog-items') filters.push({ key: 'deviceType', label: 'Loại thiết bị', value: typeFilter, onChange: setTypeFilter, options: (deviceTypes.data ?? []).map(item => ({ value: String(item.id), label: item.name })), matches: (row, value) => String(resource === 'device-models' ? row.deviceTypeId : modelMap.get(row.deviceModelId ?? -1)?.deviceTypeId) === value })
  if (resource === 'service-catalog-items') filters.push({ key: 'serviceType', label: 'Loại dịch vụ', value: serviceTypeFilter, onChange: setServiceTypeFilter, options: (serviceTypes.data ?? []).map(item => ({ value: String(item.id), label: serviceTypeLabels[item.code] })), matches: (row, value) => String(row.serviceTypeId) === value }, { key: 'brand', label: 'Hãng linh kiện', value: brandFilter, onChange: setBrandFilter, options: brands.map(value => ({ value, label: value })), matches: (row, value) => partMap.get(row.partId ?? -1)?.brand === value })
  if (resource === 'parts') filters.push({ key: 'brand', label: 'Hãng', value: brandFilter, onChange: setBrandFilter, options: brands.map(value => ({ value, label: value })), matches: (row, value) => row.brand === value })
  const sortOptions: SortOption<Row>[] = [{ value: 'name-asc', label: 'Tên A–Z', compare: (a, b) => compareText(displayName(a), displayName(b)) }, { value: 'name-desc', label: 'Tên Z–A', compare: (a, b) => compareText(displayName(b), displayName(a)) }]
  if (resource === 'parts' || resource === 'service-catalog-items') sortOptions.push({ value: 'price-asc', label: 'Giá tăng dần', compare: (a, b) => priceOf(a, partMap) - priceOf(b, partMap) }, { value: 'price-desc', label: 'Giá giảm dần', compare: (a, b) => priceOf(b, partMap) - priceOf(a, partMap) })

  return <div className="workspace-page admin-resource-page">
    <header className="admin-page-header"><div><span className="eyebrow">Danh mục</span><h1>{resource === 'parts' ? 'Quản lý thông tin linh kiện' : labels[resource]}</h1><p>{descriptions[resource]}</p></div><button className="button button--primary" onClick={create}>+ Thêm {labels[resource].toLowerCase()}</button></header>
    {grouped && <nav className="segmented" aria-label="Nhóm dữ liệu dịch vụ">{catalogResources.map(item => <button key={item} aria-current={resource === item ? 'page' : undefined} className={resource === item ? 'active' : ''} onClick={() => switchResource(item)}>{labels[item]}</button>)}</nav>}
    {rows.isLoading ? <LoadingState label="Đang tải danh sách…" /> : rows.isError ? <ErrorState error={rows.error} retry={() => rows.refetch()} /> : <AdminDataTable rows={data} rowKey={row => row.id} columns={columns} filters={filters} sortOptions={sortOptions} searchPlaceholder={resource === 'parts' ? 'Nhập linh kiện, mã, hãng hoặc phiên bản' : `Nhập ${labels[resource].toLowerCase()} cần tìm`} searchableText={row => searchableText(row, resource, typeNames, modelMap, issueNames, serviceTypeMap, partMap)} />}

    {showForm && <DetailDrawer eyebrow={editing ? 'Chỉnh sửa dữ liệu' : 'Thêm dữ liệu'} title={editing ? displayName(editing) : `Thêm ${labels[resource].toLowerCase()}`} onClose={closeForm} footer={<><button className="button button--quiet" onClick={closeForm}>Hủy</button><button className="button button--primary" disabled={!canSave(resource, form) || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu dữ liệu'}</button></>}>
      <div className="form-grid drawer-form">
        {resource === 'branches' && <>{field('name', 'Tên chi nhánh')}{field('address', 'Địa chỉ')}{field('phone', 'Điện thoại', 'tel', false)}</>}
        {resource === 'device-types' && field('name', 'Tên loại thiết bị')}
        {resource === 'device-models' && <>{select('deviceTypeId', 'Loại thiết bị', deviceTypes.data ?? [])}{field('name', 'Tên model')}</>}
        {resource === 'service-issues' && <>{field('name', 'Tên vấn đề')}<fieldset className="field"><legend>Áp dụng cho loại thiết bị</legend>{deviceTypes.isLoading ? <LoadingState /> : deviceTypes.isError ? <ErrorState error={deviceTypes.error} retry={() => deviceTypes.refetch()} /> : (deviceTypes.data ?? []).filter(type => type.status === 'ACTIVE' || (form.deviceTypeIds ?? '').split(',').includes(String(type.id))).map(type => { const selected = (form.deviceTypeIds ?? '').split(',').includes(String(type.id)); return <label key={type.id} className="check-option"><input type="checkbox" checked={selected} onChange={() => setForm(value => ({ ...value, deviceTypeIds: Array.from(new Set((value.deviceTypeIds ?? '').split(',').filter(Boolean).filter(id => id !== String(type.id)).concat(selected ? [] : [String(type.id)]))).join(',') }))} />{type.name}</label> })}</fieldset></>}
        {resource === 'service-types' && <>{select('code', 'Mã loại dịch vụ', (Object.keys(serviceTypeLabels) as ServiceTypeCode[]).map(value => ({ value, name: `${serviceTypeLabels[value]} — ${value}` })))}{field('name', 'Tên hiển thị')}</>}
        {resource === 'parts' && <>{field('partCode', 'Mã linh kiện')}{field('name', 'Tên linh kiện')}{field('brand', 'Hãng', 'text', false)}{field('variant', 'Phiên bản', 'text', false)}{field('salePrice', 'Giá bán', 'number')}</>}
        {resource === 'service-catalog-items' && <>{select('deviceModelId', 'Model', models.data ?? [])}{select('serviceIssueId', 'Vấn đề', (issues.data ?? []).filter(issue => issue.deviceTypeIds.includes(modelMap.get(Number(form.deviceModelId))?.deviceTypeId ?? -1)))}{select('serviceTypeId', 'Loại dịch vụ', (serviceTypes.data ?? []).map(item => ({ ...item, name: serviceTypeLabels[item.code] })))}{select('partId', 'Linh kiện', (parts.data ?? []).map(item => ({ ...item, name: `${item.name} · ${item.brand ?? 'Chưa rõ hãng'} · ${item.variant ?? 'Bản tiêu chuẩn'}` })), true)}{field('name', 'Tên dịch vụ')}{field('configuredPrice', 'Giá cấu hình', 'number', false)}{field('standardDurationMinutes', 'Thời lượng phút', 'number', false)}{field('warrantyDays', 'Số ngày bảo hành', 'number')}</>}
      </div>{save.isError && <ErrorState error={save.error} />}
    </DetailDrawer>}

    {detail && <DetailDrawer eyebrow={`Mã #${detail.id}`} title={displayName(detail)} onClose={() => setDetail(undefined)} footer={<><button className="button button--secondary" onClick={() => { const value = detail; setDetail(undefined); edit(value) }}>Sửa dữ liệu</button><button className="button button--quiet" onClick={() => setDetail(undefined)}>Đóng</button></>}>
      <ResourceDetail resource={resource} row={detail} typeNames={typeNames} modelMap={modelMap} issueNames={issueNames} serviceTypeMap={serviceTypeMap} partMap={partMap} branchNames={branchNames} catalogItems={catalogItems.data ?? []} inventories={inventories.data ?? []} transactions={transactions.data ?? []} loadingRelations={inventories.isLoading || transactions.isLoading} />
    </DetailDrawer>}

    {deleting && <ConfirmDialog title={`Xóa ${labels[resource].toLowerCase()}?`} busy={remove.isPending} onCancel={() => setDeleting(undefined)} onConfirm={() => remove.mutate(deleting)}><p>Dữ liệu sẽ bị xóa vĩnh viễn nếu chưa được sử dụng trong hệ thống.</p><strong>{displayName(deleting)}</strong>{remove.isError && <div className="dialog-error" role="alert">{errorMessage(remove.error)}</div>}</ConfirmDialog>}
    {toast && <Toast {...toast} onClose={() => setToast(undefined)} />}
  </div>
}

function buildColumns(resource: Resource, context: {
  typeNames: Map<number, string>; modelMap: Map<number, DeviceModelResponse>; issueNames: Map<number, string>; serviceTypeMap: Map<number, ServiceTypeResponse>; partMap: Map<number, PartResponse>
  onDetail: (row: Row) => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onToggle: (row: Row) => void; busy: boolean
}): DataColumn<Row>[] {
  const status: DataColumn<Row> = { key: 'status', label: 'Trạng thái', render: row => <StatusBadge label={row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'} tone={row.status === 'ACTIVE' ? 'success' : 'warning'} /> }
  const actions: DataColumn<Row> = { key: 'actions', label: 'Thao tác', className: 'table-actions-cell', render: row => <div className="row-actions"><button className="text-action" onClick={() => context.onDetail(row)}>Xem</button><button className="text-action" onClick={() => context.onEdit(row)}>Sửa</button><button className="text-action text-action--danger" disabled={context.busy} onClick={() => context.onDelete(row)}>Xóa</button><button className="text-action" disabled={context.busy} onClick={() => context.onToggle(row)}>{row.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'}</button></div> }
  if (resource === 'branches') return [{ key: 'name', label: 'Chi nhánh', render: row => <BusinessCell title={row.name} subtitle={row.phone ?? 'Chưa có số điện thoại'} /> }, { key: 'address', label: 'Địa chỉ', render: row => row.address }, status, actions]
  if (resource === 'device-types') return [{ key: 'name', label: 'Loại thiết bị', render: row => <BusinessCell title={row.name} subtitle={`Mã #${row.id}`} /> }, status, actions]
  if (resource === 'device-models') return [{ key: 'type', label: 'Loại thiết bị', render: row => context.typeNames.get(row.deviceTypeId ?? -1) ?? '—' }, { key: 'name', label: 'Model', render: row => <BusinessCell title={row.name} subtitle={`Mã #${row.id}`} /> }, status, actions]
  if (resource === 'service-issues') return [{ key: 'name', label: 'Vấn đề dịch vụ', render: row => <BusinessCell title={row.name} subtitle={`Mã #${row.id}`} /> }, status, actions]
  if (resource === 'service-types') return [{ key: 'name', label: 'Loại dịch vụ', render: row => <BusinessCell title={row.code ? serviceTypeLabels[row.code] : row.name} subtitle={row.code} /> }, status, actions]
  if (resource === 'parts') return [{ key: 'name', label: 'Linh kiện', render: row => <BusinessCell title={row.name} subtitle={row.partCode} /> }, { key: 'brand', label: 'Hãng', render: row => row.brand ?? 'Chưa xác định' }, { key: 'variant', label: 'Phiên bản', render: row => row.variant ?? 'Tiêu chuẩn' }, { key: 'price', label: 'Giá bán', render: row => <strong>{formatMoney(row.salePrice)}</strong> }, status, actions]
  if (resource === 'service-catalog-items') return [
    { key: 'model', label: 'Model', render: row => { const model = context.modelMap.get(row.deviceModelId ?? -1); return <BusinessCell title={model?.name} subtitle={model ? context.typeNames.get(model.deviceTypeId) : undefined} /> } },
    { key: 'issue', label: 'Vấn đề', render: row => context.issueNames.get(row.serviceIssueId ?? -1) ?? '—' },
    { key: 'serviceType', label: 'Loại dịch vụ', render: row => { const type = context.serviceTypeMap.get(row.serviceTypeId ?? -1); return <BusinessCell title={type ? serviceTypeLabels[type.code] : undefined} subtitle={type?.code} /> } },
    { key: 'part', label: 'Linh kiện', render: row => { const part = context.partMap.get(row.partId ?? -1); return part ? <BusinessCell title={part.name} subtitle={[part.brand, part.variant].filter(Boolean).join(' · ')} /> : <span className="muted-text">Không áp dụng</span> } },
    { key: 'price', label: 'Giá', render: row => <strong>{formatMoney(priceOf(row, context.partMap))}</strong> },
    { key: 'duration', label: 'Thời gian', render: row => row.standardDurationMinutes ? `${row.standardDurationMinutes} phút` : 'Xác nhận sau' },
    { key: 'warranty', label: 'Bảo hành', render: row => row.warrantyDays ? `${row.warrantyDays} ngày` : 'Không áp dụng' },
    status, actions,
  ]
  return [status, actions]
}

function ResourceDetail({ resource, row, typeNames, modelMap, issueNames, serviceTypeMap, partMap, branchNames, catalogItems, inventories, transactions, loadingRelations }: {
  resource: Resource; row: Row; typeNames: Map<number, string>; modelMap: Map<number, DeviceModelResponse>; issueNames: Map<number, string>; serviceTypeMap: Map<number, ServiceTypeResponse>; partMap: Map<number, PartResponse>; branchNames: Map<number, string>
  catalogItems: ServiceCatalogItemResponse[]; inventories: { id: number; branchId: number; partId: number; quantity: number; updatedAt: string }[]; transactions: { id: number; transactionType: string; quantity: number; sourceBranchId: number | null; destinationBranchId: number | null; createdAt: string }[]; loadingRelations: boolean
}) {
  if (resource === 'parts') {
    const usedBy = catalogItems.filter(item => item.partId === row.id)
    return <div className="detail-stack">
      <DetailSection title="Thông tin linh kiện"><dl className="detail-grid"><Data label="Tên" value={row.name} /><Data label="Mã linh kiện" value={row.partCode} /><Data label="Hãng" value={row.brand ?? 'Chưa xác định'} /><Data label="Phiên bản" value={row.variant ?? 'Tiêu chuẩn'} /><Data label="Giá bán" value={formatMoney(row.salePrice)} /><Data label="Trạng thái" value={row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'} /></dl></DetailSection>
      <DetailSection title="Danh mục dịch vụ đang sử dụng"><RelationshipList empty="Chưa có dịch vụ nào sử dụng linh kiện này.">{usedBy.map(item => { const model = modelMap.get(item.deviceModelId); const type = serviceTypeMap.get(item.serviceTypeId); return <li key={item.id}><strong>{item.name}</strong><span>{model?.name} · {issueNames.get(item.serviceIssueId)} · {type ? serviceTypeLabels[type.code] : ''}</span></li> })}</RelationshipList></DetailSection>
      <DetailSection title="Tồn kho theo chi nhánh">{loadingRelations ? <LoadingState /> : <RelationshipList empty="Chưa phát sinh tồn kho tại chi nhánh.">{inventories.map(item => <li key={item.id}><strong>{branchNames.get(item.branchId) ?? `Chi nhánh #${item.branchId}`}</strong><span>{item.quantity} linh kiện · cập nhật {formatDateTime(item.updatedAt)}</span></li>)}</RelationshipList>}</DetailSection>
      <DetailSection title="Lịch sử biến động">{loadingRelations ? <LoadingState /> : <RelationshipList empty="Chưa có biến động tồn kho.">{transactions.slice(0, 12).map(item => <li key={item.id}><strong>{transactionLabel(item.transactionType)} · {item.quantity}</strong><span>{formatDateTime(item.createdAt)} · {movementBranches(item, branchNames)}</span></li>)}</RelationshipList>}</DetailSection>
    </div>
  }
  if (resource === 'service-catalog-items') {
    const model = modelMap.get(row.deviceModelId ?? -1); const type = serviceTypeMap.get(row.serviceTypeId ?? -1); const part = partMap.get(row.partId ?? -1)
    return <div className="detail-stack"><DetailSection title="Quan hệ danh mục"><dl className="detail-grid"><Data label="Loại thiết bị" value={model ? typeNames.get(model.deviceTypeId) : undefined} /><Data label="Model" value={model?.name} /><Data label="Vấn đề" value={issueNames.get(row.serviceIssueId ?? -1)} /><Data label="Loại dịch vụ" value={type ? serviceTypeLabels[type.code] : undefined} /><Data label="Linh kiện" value={part ? `${part.name} · ${part.brand ?? ''} · ${part.variant ?? ''}` : 'Không áp dụng'} /><Data label="Giá hiển thị" value={formatMoney(priceOf(row, partMap))} /><Data label="Thời gian" value={row.standardDurationMinutes ? `${row.standardDurationMinutes} phút` : 'Xác nhận sau'} /><Data label="Bảo hành" value={row.warrantyDays ? `${row.warrantyDays} ngày` : 'Không áp dụng'} /></dl></DetailSection></div>
  }
  return <DetailSection title="Thông tin dữ liệu"><dl className="detail-grid">{Object.entries(row).filter(([key]) => !['createdAt', 'updatedAt'].includes(key)).map(([key, value]) => <Data key={key} label={fieldLabel(key)} value={String(value ?? '—')} />)}</dl></DetailSection>
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section className="detail-section"><h3>{title}</h3>{children}</section> }
function Data({ label, value }: { label: string; value: ReactNode }) { return <div><dt>{label}</dt><dd>{value || '—'}</dd></div> }
function RelationshipList({ children, empty }: { children: ReactNode[]; empty: string }) { return children.length ? <ul className="relationship-list">{children}</ul> : <EmptyState title={empty} /> }
function BusinessCell({ title, subtitle }: { title?: string; subtitle?: string }) { return <div className="business-cell"><strong>{title || '—'}</strong>{subtitle && <small>{subtitle}</small>}</div> }
function displayName(row: Row) { return String(row.name ?? row.partCode ?? row.code ?? `#${row.id}`) }
function priceOf(row: Row, parts: Map<number, PartResponse>) { return Number(row.salePrice ?? row.configuredPrice ?? parts.get(row.partId ?? -1)?.salePrice ?? 0) }
function searchableText(row: Row, resource: Resource, typeNames: Map<number, string>, models: Map<number, DeviceModelResponse>, issues: Map<number, string>, types: Map<number, ServiceTypeResponse>, parts: Map<number, PartResponse>) {
  const values: unknown[] = Object.values(row)
  if (resource === 'device-models') values.push(typeNames.get(row.deviceTypeId ?? -1))
  if (resource === 'service-catalog-items') { const model = models.get(row.deviceModelId ?? -1); const type = types.get(row.serviceTypeId ?? -1); const part = parts.get(row.partId ?? -1); values.push(model?.name, model ? typeNames.get(model.deviceTypeId) : '', issues.get(row.serviceIssueId ?? -1), type?.code, type ? serviceTypeLabels[type.code] : '', part?.name, part?.brand, part?.variant) }
  return values.filter(value => value != null).join(' ')
}
function canSave(resource: Resource, form: Record<string, string>) {
  if (!form.name?.trim()) return false
  if (resource === 'branches') return Boolean(form.address?.trim())
  if (resource === 'device-models') return Boolean(form.deviceTypeId)
  if (resource === 'service-issues') return Boolean(form.deviceTypeIds?.split(',').filter(Boolean).length)
  if (resource === 'service-types') return Boolean(form.code)
  if (resource === 'parts') return Boolean(form.partCode?.trim() && form.salePrice !== '' && Number(form.salePrice) >= 0)
  if (resource === 'service-catalog-items') return Boolean(form.deviceModelId && form.serviceIssueId && form.serviceTypeId && Number(form.warrantyDays || 0) >= 0)
  return true
}
function errorMessage(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : 'Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.' }
function fieldLabel(key: string) { return ({ id: 'Mã', name: 'Tên', status: 'Trạng thái', address: 'Địa chỉ', phone: 'Điện thoại', code: 'Mã kỹ thuật', deviceTypeId: 'Loại thiết bị' } as Record<string, string>)[key] ?? key }
function transactionLabel(type: string) { return ({ STOCK_IN: 'Nhập kho', STOCK_OUT: 'Xuất kho', USAGE_OUT: 'Sử dụng sửa chữa', USAGE_RETURN: 'Hoàn tác sử dụng', TRANSFER: 'Chuyển kho' } as Record<string, string>)[type] ?? type }
function movementBranches(item: { sourceBranchId: number | null; destinationBranchId: number | null }, branches: Map<number, string>) { const source = item.sourceBranchId ? branches.get(item.sourceBranchId) ?? `#${item.sourceBranchId}` : null; const destination = item.destinationBranchId ? branches.get(item.destinationBranchId) ?? `#${item.destinationBranchId}` : null; return [source, destination].filter(Boolean).join(' → ') || 'Hệ thống' }
