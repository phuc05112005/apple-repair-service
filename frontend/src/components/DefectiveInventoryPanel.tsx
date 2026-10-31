import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { timingApi } from '../api/timingApi'
import { adminApi } from '../api/adminApi'
import type { DefectivePartStatus } from '../api/contracts'
import { ErrorState, LoadingState } from './AsyncState'
import { formatDateTime } from '../utils/format'
import { AdminDataTable, type DataColumn } from './AdminDataTable'
import { StatusBadge } from './StatusBadge'
import { DetailDrawer } from './Dialog'

export interface DefectivePartResponse {
  id: number
  partId: number
  partName: string
  branchId: number
  branchName: string
  quantity: number
  status: DefectivePartStatus | string
  ticketId: number
  repairItemId: number
  receivedAt: string
  reason?: string | null
  note?: string | null
}

// Từ điển chuẩn hóa Tiếng Việt rõ nghĩa cho trạng thái linh kiện lỗi (Dùng nội bộ)
const DEFECTIVE_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'Đang lưu kho lỗi (Chờ xử lý)',
  SENT_TO_SUPPLIER: 'Đã gửi Nhà cung cấp (Chờ đổi)',
  RESOLVED: 'Đã xử lý xong (Đổi mới / Bồi hoàn)',
  DISPOSED: 'Đã tiêu hủy nội bộ',
  REJECTED: 'NCC từ chối bảo hành',
}

const statusToneMap: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  IN_STOCK: 'warning',
  SENT_TO_SUPPLIER: 'info',
  RESOLVED: 'success',
  DISPOSED: 'danger',
  REJECTED: 'danger',
}

/**
 * Hàm làm sạch và Việt hóa toàn bộ văn bản ghi chú / lý do chứa mã hệ thống (Dùng nội bộ)
 */
function cleanDefectiveNote(text?: string | null): string {
  if (!text || !text.trim()) return ''
  let result = text

  const rawReplacements: Record<string, string> = {
    LINH_KIEN_LOI_NSX: 'Linh kiện lỗi từ nhà sản xuất',
    LOI_KY_THUAT: 'Lỗi kỹ thuật khi sửa chữa',
    KHONG_TIEP_XUC: 'Không tiếp xúc / Hỏng chân cắm',
    DOI_TRA_KHACH: 'Thu hồi từ máy khách hàng',
    IN_STOCK: 'Đang lưu kho lỗi (Chờ xử lý)',
    SENT_TO_SUPPLIER: 'Đã gửi Nhà cung cấp (Chờ đổi)',
    RESOLVED: 'Đã xử lý xong (Đổi mới / Bồi hoàn)',
    DISPOSED: 'Đã tiêu hủy nội bộ',
    REJECTED: 'NCC từ chối bảo hành',
  }

  // Việt hóa mã trạng thái và mã lý do
  Object.entries(rawReplacements).forEach(([raw, vi]) => {
    result = result.replaceAll(raw, vi)
  })

  // Định dạng ISO timestamp 2026-10-31T14:29:12.274258 thành ngày giờ Việt Nam
  result = result.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?/g, match => {
    try {
      const [datePart, timePart] = match.split('T')
      const timeClean = timePart.split('.')[0]
      const [yyyy, mm, dd] = datePart.split('-')
      return `${dd}/${mm}/${yyyy} ${timeClean}`
    } catch {
      return match
    }
  })

  // Chuẩn hóa dấu mũi tên chuyển trạng thái
  result = result.replace(/\s*->\s*/g, ' → ')

  return result
}

function ExpandableNote({ text, maxLen = 45 }: { text?: string | null; maxLen?: number }) {
  const [expanded, setExpanded] = useState(false)
  const cleaned = useMemo(() => cleanDefectiveNote(text), [text])

  if (!cleaned || !cleaned.trim()) return <span className="muted-text">—</span>
  if (cleaned.length <= maxLen) return <span>{cleaned}</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '300px' }}>
      <span style={{ lineHeight: '1.4' }}>{expanded ? cleaned : `${cleaned.slice(0, maxLen)}...`}</span>
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

export function DefectiveInventoryPanel({ ticketId, embedded }: { ticketId?: number; embedded?: boolean }) {
  const client = useQueryClient()

  // --- Filter State ---
  const [branchFilter, setBranchFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [partFilter, setPartFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedRow, setSelectedRow] = useState<DefectivePartResponse | null>(null)
  const [status, setStatus] = useState<DefectivePartStatus>('SENT_TO_SUPPLIER')
  const [note, setNote] = useState('')

  // --- Queries ---
  const rows = useQuery({
    queryKey: ticketId ? ['internal', 'defective', ticketId] : ['admin', 'defective'],
    queryFn: ({ signal }) => (ticketId ? timingApi.defectiveForTicket(ticketId, signal) : timingApi.defective(undefined, undefined, signal)),
  })

  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal), enabled: !ticketId })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal), enabled: !ticketId })
  const models = useQuery({ queryKey: ['admin', 'device-models'], queryFn: ({ signal }) => adminApi.resourceList<{ id: number; name: string }>('device-models', signal), enabled: !ticketId })

  // --- Maps ---
  const partMap = useMemo(() => new Map(parts.data?.map(item => [item.id, item])), [parts])

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



  // Thao tác cập nhật trạng thái
  const change = useMutation({
    mutationFn: () => {
      const fromLabel = DEFECTIVE_STATUS_LABELS[selectedRow!.status] ?? selectedRow!.status
      const toLabel = DEFECTIVE_STATUS_LABELS[status] ?? status
      const currentFormattedTime = formatDateTime(new Date().toISOString())
      const formattedLog = `[${currentFormattedTime} · ${fromLabel} → ${toLabel}] ${note.trim()}`

      return timingApi.defectiveStatus(selectedRow!.id, status, formattedLog)
    },
    onSuccess: async () => {
      setSelectedRow(null)
      setNote('')
      await client.invalidateQueries({ queryKey: ['admin', 'defective'] })
    },
  })

  // Filter dữ liệu
  const filteredRows = useMemo(() => {
    let list = rows.data ?? []

    if (branchFilter) {
      list = list.filter(r => String(r.branchId) === branchFilter)
    }

    if (statusFilter) {
      list = list.filter(r => r.status === statusFilter)
    }

    if (partFilter) {
      list = list.filter(r => String(r.partId) === partFilter)
    }

    if (modelFilter) {
      const targetModelId = Number(modelFilter)
      list = list.filter(r => {
        const part = partMap.get(r.partId) as (typeof partMap extends Map<number, infer T> ? T & { deviceModelIds?: number[]; deviceModelId?: number } : never) | undefined
        if (!part) return false
        const ids = part.deviceModelIds && part.deviceModelIds.length ? part.deviceModelIds : part.deviceModelId ? [part.deviceModelId] : []
        return ids.length === 0 || ids.includes(targetModelId)
      })
    }

   

    return list
  }, [rows.data, branchFilter, statusFilter, partFilter, modelFilter, partMap])

  if (ticketId && !rows.isLoading && (!rows.data || rows.data.length === 0)) {
    return null
  }

  const columns: DataColumn<DefectivePartResponse>[] = [
    {
      key: 'part',
      label: 'Linh kiện thu hồi',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <strong style={{ fontSize: '0.875rem' }}>{row.partName}</strong>
          <small className="muted-text" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
            ID linh kiện: #{row.partId}
          </small>
        </div>
      ),
    },
    {
      key: 'branch',
      label: 'Chi nhánh lưu trữ',
      render: row => <strong style={{ whiteSpace: 'nowrap' }}>{row.branchName}</strong>,
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      render: row => <strong className="quantity-cell" style={{ fontSize: '1rem', color: '#b91c1c' }}>{row.quantity}</strong>,
    },
    {
      key: 'status',
      label: 'Trạng thái xử lý',
      render: row => (
        <StatusBadge
          label={DEFECTIVE_STATUS_LABELS[row.status] ?? row.status}
          tone={statusToneMap[row.status] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'source',
      label: 'Nguồn & Thời gian',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <span>Phiếu #{row.ticketId} · Mục #{row.repairItemId}</span>
          <small className="muted-text" style={{ fontSize: '0.75rem' }}>
            {formatDateTime(row.receivedAt)}
          </small>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Lý do & Ghi chú thu hồi',
      render: row => (
        <div>
          <ExpandableNote text={row.reason ? `${row.reason}${row.note ? ` (${row.note})` : ''}` : row.note} />
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'table-actions-cell',
      render: row => (
        !ticketId && ['IN_STOCK', 'SENT_TO_SUPPLIER'].includes(row.status) ? (
          <button
            className="text-action"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              setSelectedRow(row)
              setStatus(row.status === 'IN_STOCK' ? 'SENT_TO_SUPPLIER' : 'RESOLVED')
              setNote('')
            }}
          >
            Cập nhật xử lý
          </button>
        ) : (
          <span className="muted-text" style={{ fontSize: '0.8125rem' }}>Đã hoàn tất</span>
        )
      ),
    },
  ]

  const content = (
    <>
      {!ticketId && (
        <div className="defective-filters" style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <label className="field">
            <span className="field-label"><b>Chi nhánh</b></span>
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {(branches.data ?? []).map(b => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label"><b>Dòng máy tương thích</b></span>
            <select value={modelFilter} onChange={e => setModelFilter(e.target.value)}>
              <option value="">Tất cả dòng máy</option>
              {(models.data ?? []).map(m => (
                <option key={m.id} value={String(m.id)}>{m.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label"><b>Linh kiện (Theo Hãng)</b></span>
            <select value={partFilter} onChange={e => setPartFilter(e.target.value)}>
              <option value="">Tất cả linh kiện</option>
              {groupedParts.map(group => (
                <optgroup key={group.brand} label={`── HÃNG ${group.brand.toUpperCase()} ──`}>
                  {group.items.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.variant ? `(${p.variant})` : ''} [{p.partCode}]
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label"><b>Trạng thái xử lý</b></span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(DEFECTIVE_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {rows.isLoading ? (
        <LoadingState label="Đang tải danh sách linh kiện lỗi…" />
      ) : rows.isError ? (
        <ErrorState error={rows.error} retry={() => rows.refetch()} />
      ) : (
        <AdminDataTable
          rows={filteredRows}
          rowKey={row => row.id}
          columns={columns}
          searchPlaceholder="Nhập tên linh kiện, chi nhánh, nhà cung cấp, mã phiếu hoặc lý do..."
          searchableText={row => {
            const cleanedNote = cleanDefectiveNote(row.note)
            const cleanedReason = cleanDefectiveNote(row.reason)
            return `${row.partName} ${row.branchName} ${row.ticketId} ${cleanedReason} ${cleanedNote}`
          }}
          sortOptions={[
            { value: 'date-desc', label: 'Mới nhận gần đây', compare: (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime() },
            { value: 'quantity-desc', label: 'Số lượng giảm dần', compare: (a, b) => b.quantity - a.quantity },
          ]}
        />
      )}

      {selectedRow && (
        <DetailDrawer
          eyebrow="Biên nhận kho lỗi"
          title={`Cập nhật linh kiện lỗi #${selectedRow.id}`}
          onClose={() => setSelectedRow(null)}
          footer={
            <div className="button-row">
              <button
                className="button button--primary"
                disabled={change.isPending || !note.trim()}
                onClick={() => change.mutate()}
              >
                {change.isPending ? 'Đang lưu...' : 'Lưu trạng thái'}
              </button>
              <button className="button button--quiet" onClick={() => setSelectedRow(null)}>
                Hủy
              </button>
            </div>
          }
        >
          <div className="drawer-form">
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedRow.partName}</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '2px' }}>
                Chi nhánh: {selectedRow.branchName} · Số lượng: <strong>{selectedRow.quantity} chiếc</strong>
              </div>
            </div>

            <label className="field">
              <span className="field-label"><b>Trạng thái xử lý mới <span style={{ color: '#ef4444' }}>*</span></b></span>
              <select value={status} onChange={e => setStatus(e.target.value as DefectivePartStatus)}>
                {Object.entries(DEFECTIVE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="field" style={{ marginTop: '12px' }}>
              <span className="field-label"><b>Ghi chú / Kết quả xử lý <span style={{ color: '#ef4444' }}>*</span></b></span>
              <textarea
                required
                rows={4}
                maxLength={5000}
                placeholder="Nhập tên Nhà cung cấp, số biên nhận, địa điểm gửi hoặc kết quả tiêu hủy..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            {change.isError && <ErrorState error={change.error} />}
          </div>
        </DetailDrawer>
      )}
    </>
  )

  if (embedded) return content

  return (
    <section className="ops-section defective-panel">
      <div className="ops-section__title">
        <span>▣</span>
        <h2>Linh kiện lỗi {ticketId ? `đã thu hồi (Phiếu #${ticketId})` : 'đang quản lý'}</h2>
      </div>
      {content}
    </section>
  )
}