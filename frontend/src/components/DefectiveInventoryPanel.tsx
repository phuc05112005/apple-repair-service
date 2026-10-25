import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { timingApi } from '../api/timingApi'
import { adminApi } from '../api/adminApi'
import type { DefectivePartStatus } from '../api/contracts'
import { ErrorState, LoadingState, EmptyState } from './AsyncState'
import { formatDateTime } from '../utils/format'
import { defectiveStatusLabels } from '../types/labels'

export function DefectiveInventoryPanel({ ticketId }: { ticketId?: number }) {
  const client = useQueryClient()
  const [branch, setBranch] = useState<number>()
  const [part, setPart] = useState<number>()
  const [selected, setSelected] = useState<number>()
  const [status, setStatus] = useState<DefectivePartStatus>('SENT_TO_SUPPLIER')
  const [note, setNote] = useState('')

  const rows = useQuery({ 
    queryKey: ticketId ? ['internal', 'defective', ticketId] : ['admin', 'defective', branch, part], 
    queryFn: ({ signal }) => ticketId ? timingApi.defectiveForTicket(ticketId, signal) : timingApi.defective(branch, part, signal) 
  })

  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal), enabled: !ticketId })
  const parts = useQuery({ queryKey: ['admin', 'parts'], queryFn: ({ signal }) => adminApi.parts(signal), enabled: !ticketId })

  const change = useMutation({ 
    mutationFn: () => timingApi.defectiveStatus(selected!, status, note), 
    onSuccess: async () => { setSelected(undefined); setNote(''); await client.invalidateQueries({ queryKey: ['admin', 'defective'] }) } 
  })

  // Nếu xem trong chi tiết phiếu và KHÔNG CÓ linh kiện lỗi thu hồi -> ẨN LUÔN BẢNG
  if (ticketId && !rows.isLoading && (!rows.data || rows.data.length === 0)) {
    return null
  }

  const grouped = new Map<string, { branch: string; part: string; quantity: number }>()
  for (const row of rows.data ?? []) {
    if (row.status === 'IN_STOCK') { 
      const key = `${row.branchId}:${row.partId}`
      const old = grouped.get(key)
      grouped.set(key, { branch: row.branchName, part: row.partName, quantity: (old?.quantity ?? 0) + row.quantity }) 
    }
  }

  return (
    <section className="ops-section defective-panel">
      <div className="ops-section__title"><span>▣</span><h2>Linh kiện lỗi {ticketId ? 'đã thu hồi' : 'đang quản lý'}</h2></div>
      <p>Kho lỗi được theo dõi riêng. Số lượng này không thể xuất cho dịch vụ và không được cộng vào tồn kho linh kiện tốt.</p>

      {!ticketId && (
        <div className="form-grid">
          <label className="field">
            <span>Chi nhánh</span>
            <select value={branch ?? ''} onChange={e => setBranch(Number(e.target.value) || undefined)}>
              <option value="">Tất cả chi nhánh</option>
              {branches.data?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Linh kiện</span>
            <select value={part ?? ''} onChange={e => setPart(Number(e.target.value) || undefined)}>
              <option value="">Tất cả linh kiện</option>
              {parts.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      )}

      {rows.isLoading ? <LoadingState /> : rows.isError ? <ErrorState error={rows.error} retry={() => rows.refetch()} /> : !rows.data?.length ? <EmptyState title="Chưa có linh kiện lỗi thu hồi" /> : (
        <>
          <div className="defective-onhand">
            {[...grouped].map(([key, row]) => (
              <div key={key}><span>{row.branch} · {row.part}</span><strong>{row.quantity} đang giữ</strong></div>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chi nhánh / linh kiện</th>
                  <th>Số lượng</th>
                  <th>Trạng thái</th>
                  <th>Nguồn & ghi nhận</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {rows.data.map(row => (
                  <tr key={row.id}>
                    <td><strong>{row.partName}</strong><br />{row.branchName}</td>
                    <td>{row.quantity}</td>
                    <td>{defectiveStatusLabels[row.status]}</td>
                    <td>Phiếu #{row.ticketId} · Hạng mục #{row.repairItemId}<br /><small>{formatDateTime(row.receivedAt)}</small></td>
                    <td>
                      <details>
                        <summary>Mô tả thu hồi</summary>
                        <p>{row.reason}</p>
                        {row.note && <p>{row.note}</p>}
                        <small>Xuất linh kiện #{row.sourcePartUsageId} · Người ghi nhận #{row.recordedById}</small>
                      </details>
                      {!ticketId && ['IN_STOCK', 'SENT_TO_SUPPLIER'].includes(row.status) && (
                        <button className="text-action" onClick={() => { setSelected(row.id); setStatus(row.status === 'IN_STOCK' ? 'SENT_TO_SUPPLIER' : 'RESOLVED'); setNote('') }}>
                          Cập nhật xử lý
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <form className="timing-manual-form" onSubmit={e => { e.preventDefault(); change.mutate() }}>
          <h3>Cập nhật biên nhận #{selected}</h3>
          <div className="form-grid">
            <label className="field">
              <span>Trạng thái xử lý</span>
              <select value={status} onChange={e => setStatus(e.target.value as DefectivePartStatus)}>
                {Object.entries(defectiveStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Ghi chú xử lý</span>
              <textarea required maxLength={5000} placeholder="Nhập lý do, nơi chuyển hoặc kết quả xử lý" value={note} onChange={e => setNote(e.target.value)} />
            </label>
          </div>
          <div className="button-row">
            <button className="button button--primary" disabled={change.isPending || !note.trim()}>Lưu trạng thái</button>
            <button type="button" className="button button--quiet" onClick={() => setSelected(undefined)}>Hủy</button>
          </div>
        </form>
      )}
      {change.isError && <ErrorState error={change.error} />}
    </section>
  )
}