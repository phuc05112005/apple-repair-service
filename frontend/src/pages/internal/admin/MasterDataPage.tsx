import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ActiveStatus, DeviceModelResponse, DeviceTypeResponse, PartResponse, ServiceIssueResponse, ServiceTypeResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'

type Resource = 'branches' | 'device-types' | 'device-models' | 'service-issues' | 'service-types' | 'service-catalog-items' | 'parts'
interface Row { id: number; name?: string; status: ActiveStatus; [key: string]: unknown }
const labels: Record<Resource, string> = { branches: 'Chi nhánh', 'device-types': 'Loại thiết bị', 'device-models': 'Model thiết bị', 'service-issues': 'Nhóm vấn đề', 'service-types': 'Loại dịch vụ', 'service-catalog-items': 'Danh mục dịch vụ', parts: 'Linh kiện' }
const catalogResources: Resource[] = ['device-types', 'device-models', 'service-issues', 'service-types', 'service-catalog-items']

export function MasterDataPage({ initial, grouped = false }: { initial: Resource; grouped?: boolean }) {
  const client = useQueryClient()
  const [resource, setResource] = useState<Resource>(initial)
  const [editing, setEditing] = useState<Row>()
  const [form, setForm] = useState<Record<string, string>>({ warrantyDays: '0' })
  useEffect(() => { setResource(initial); setEditing(undefined); setForm({ warrantyDays: '0' }) }, [initial])
  const rows = useQuery({ queryKey: ['admin', resource], queryFn: ({ signal }) => adminApi.resourceList<Row>(resource, signal) })
  const deviceTypes = useQuery({ queryKey: ['admin', 'device-types'], queryFn: ({ signal }) => adminApi.resourceList<DeviceTypeResponse>('device-types', signal), enabled: resource === 'device-models' || resource === 'service-catalog-items' })
  const models = useQuery({ queryKey: ['admin', 'device-models'], queryFn: ({ signal }) => adminApi.resourceList<DeviceModelResponse>('device-models', signal), enabled: resource === 'service-catalog-items' })
  const issues = useQuery({ queryKey: ['admin', 'service-issues'], queryFn: ({ signal }) => adminApi.resourceList<ServiceIssueResponse>('service-issues', signal), enabled: resource === 'service-catalog-items' })
  const serviceTypes = useQuery({ queryKey: ['admin', 'service-types'], queryFn: ({ signal }) => adminApi.resourceList<ServiceTypeResponse>('service-types', signal), enabled: resource === 'service-catalog-items' })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.resourceList<PartResponse>('parts', signal), enabled: resource === 'service-catalog-items' })

  function payload() {
    if (resource === 'device-models') return { deviceTypeId: Number(form.deviceTypeId), name: form.name }
    if (resource === 'service-types') return { code: form.code, name: form.name }
    if (resource === 'service-catalog-items') return { deviceModelId: Number(form.deviceModelId), serviceTypeId: Number(form.serviceTypeId), serviceIssueId: Number(form.serviceIssueId), partId: form.partId ? Number(form.partId) : null, name: form.name, configuredPrice: form.configuredPrice ? Number(form.configuredPrice) : null, standardDurationMinutes: form.standardDurationMinutes ? Number(form.standardDurationMinutes) : null, warrantyDays: Number(form.warrantyDays || 0) }
    if (resource === 'parts') return { partCode: form.partCode, name: form.name, brand: form.brand || null, variant: form.variant || null, salePrice: Number(form.salePrice) }
    if (resource === 'branches') return { name: form.name, address: form.address, phone: form.phone || null }
    return { name: form.name }
  }
  const save = useMutation({ mutationFn: () => editing ? adminApi.resourceUpdate<Row>(resource, editing.id, payload()) : adminApi.resourceCreate<Row>(resource, payload()), onSuccess: async () => { setEditing(undefined); setForm({ warrantyDays: '0' }); await client.invalidateQueries({ queryKey: ['admin', resource] }) } })
  const toggle = useMutation({ mutationFn: (row: Row) => adminApi.resourceStatus<Row>(resource, row.id, row.status !== 'ACTIVE'), onSuccess: () => client.invalidateQueries({ queryKey: ['admin', resource] }) })
  const remove = useMutation({ mutationFn: (row: Row) => adminApi.resourceDelete(resource, row.id), onSuccess: async (_, row) => { if (editing?.id === row.id) { setEditing(undefined); setForm({ warrantyDays: '0' }) } await client.invalidateQueries({ queryKey: ['admin', resource] }) } })
  function edit(row: Row) { setEditing(row); setForm(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]))) }
  function confirmDelete(row: Row) { if (window.confirm('Bạn có chắc muốn xóa dữ liệu này?')) remove.mutate(row) }
  function field(key: string, label: string, type = 'text') { return <label className="field"><span>{label}</span><input type={type} value={form[key] ?? ''} onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))} /></label> }
  function select(key: string, label: string, options: { id?: number; value?: string; name: string }[], optional = false) { return <label className="field"><span>{label}</span><select value={form[key] ?? ''} onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))}><option value="">{optional ? 'Không áp dụng' : `Chọn ${label.toLowerCase()}`}</option>{options.map(option => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.name}</option>)}</select></label> }

  return <div className="workspace-page"><header><span className="eyebrow">Quản trị dữ liệu nền</span><h1>{labels[resource]}</h1><p>Tạo, cập nhật và thay đổi trạng thái bằng API quản trị.</p></header>
    {grouped && <div className="segmented">{catalogResources.map(item => <button key={item} className={resource === item ? 'active' : ''} onClick={() => { setResource(item); setEditing(undefined); setForm({ warrantyDays: '0' }) }}>{labels[item]}</button>)}</div>}
    <section className="form-panel"><div className="panel-heading"><span>{editing ? 'SỬA' : 'MỚI'}</span><div><h2>{editing ? `Cập nhật #${editing.id}` : `Thêm ${labels[resource].toLowerCase()}`}</h2></div></div><div className="form-grid">
      {resource === 'branches' && <>{field('name', 'Tên chi nhánh')}{field('address', 'Địa chỉ')}{field('phone', 'Điện thoại')}</>}
      {resource === 'device-types' && field('name', 'Tên loại thiết bị')}
      {resource === 'device-models' && <>{select('deviceTypeId', 'Loại thiết bị', deviceTypes.data ?? [])}{field('name', 'Tên model')}</>}
      {resource === 'service-issues' && field('name', 'Tên nhóm vấn đề')}
      {resource === 'service-types' && <>{select('code', 'Mã loại dịch vụ', ['REPAIR', 'REPLACEMENT', 'INSPECTION', 'WARRANTY'].map(value => ({ value, name: value })))}{field('name', 'Tên hiển thị')}</>}
      {resource === 'parts' && <>{field('partCode', 'Mã linh kiện')}{field('name', 'Tên linh kiện')}{field('brand', 'Hãng')}{field('variant', 'Phiên bản')}{field('salePrice', 'Giá bán', 'number')}</>}
      {resource === 'service-catalog-items' && <>{select('deviceModelId', 'Model', models.data ?? [])}{select('serviceIssueId', 'Nhóm vấn đề', issues.data ?? [])}{select('serviceTypeId', 'Loại dịch vụ', serviceTypes.data ?? [])}{select('partId', 'Linh kiện', parts.data ?? [], true)}{field('name', 'Tên dịch vụ')}{field('configuredPrice', 'Giá cấu hình', 'number')}{field('standardDurationMinutes', 'Thời lượng phút', 'number')}{field('warrantyDays', 'Số ngày bảo hành', 'number')}</>}
    </div>{save.isError && <ErrorState error={save.error} />}<div className="panel-actions">{editing && <button className="button button--quiet" onClick={() => { setEditing(undefined); setForm({ warrantyDays: '0' }) }}>Hủy sửa</button>}<button className="button button--primary" disabled={save.isPending || !form.name?.trim()} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button></div></section>
    {remove.isError && <ErrorState error={remove.error} />}
    {rows.isLoading ? <LoadingState /> : rows.isError ? <ErrorState error={rows.error} retry={() => rows.refetch()} /> : !rows.data?.length ? <EmptyState title="Chưa có dữ liệu" /> : <div className="appointment-list">{rows.data.map(row => <article key={row.id}><div><span className="record-code">#{row.id}</span><h3>{String(row.name ?? row.partCode ?? row.code)}</h3><p>{row.brand ? `${row.brand} · ${row.variant ?? ''}` : row.address ? String(row.address) : row.code ? String(row.code) : ''}</p></div><div><StatusBadge label={row.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'} tone={row.status === 'ACTIVE' ? 'success' : 'warning'} /><button className="button button--secondary" onClick={() => edit(row)}>Sửa</button><button className="button button--danger" disabled={remove.isPending} onClick={() => confirmDelete(row)}>Xóa</button><button className="button button--quiet" disabled={toggle.isPending} onClick={() => toggle.mutate(row)}>{row.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'}</button></div></article>)}</div>}
  </div>
}
