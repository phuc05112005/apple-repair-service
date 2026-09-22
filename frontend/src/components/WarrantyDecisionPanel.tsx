import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { publicApi } from '../api/publicApi'
import { technicianApi } from '../api/technicianApi'
import type { RepairItemResponse, WarrantyDecision, WarrantyRemedy } from '../api/contracts'
import { ErrorState } from './AsyncState'

export function WarrantyDecisionPanel({ item, modelId, ticketId, onSaved }: { item: RepairItemResponse; modelId: number; ticketId: number; onSaved: () => void }) {
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const [remedy, setRemedy] = useState<WarrantyRemedy>('REPAIR')
  const [replacementId, setReplacementId] = useState<number>()
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId }, signal) })
  const issueId = catalog.data?.find(entry => entry.id === item.serviceCatalogItemId)?.serviceIssueId
  const choices = catalog.data?.filter(entry => entry.serviceTypeCode === 'REPLACEMENT' && entry.serviceIssueId === issueId) ?? []
  const save = useMutation({ mutationFn: (decision: Exclude<WarrantyDecision, null>) => technicianApi.warrantyDecision(item.id, decision, note, remedy, remedy === 'REPLACEMENT' ? replacementId : undefined),
    onSuccess: async () => { onSaved(); await client.invalidateQueries({ queryKey: ['internal', 'ticket', ticketId] }) } })
  return <div className="warranty-decision-panel">
    <p>Bảo hành chỉ miễn phí hạng mục này. Dịch vụ khác được thêm và tính giá riêng trong phương án.</p>
    <label className="field"><span>Cách xử lý bảo hành hợp lệ</span><select value={remedy} onChange={event => setRemedy(event.target.value as WarrantyRemedy)}><option value="REPAIR">Sửa chữa miễn phí</option><option value="REPLACEMENT">Thay linh kiện miễn phí</option></select></label>
    {remedy === 'REPLACEMENT' && <label className="field"><span>Linh kiện thay theo danh mục</span><select value={replacementId ?? ''} onChange={event => setReplacementId(Number(event.target.value) || undefined)}><option value="">Chọn phương án thay phù hợp</option>{choices.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {[entry.partBrand, entry.partVariant].filter(Boolean).join(' · ')}</option>)}</select><small>Sau khi chấp nhận, cần xuất linh kiện và ghi nhận linh kiện lỗi thu hồi.</small></label>}
    {catalog.isError && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}
    <label className="field"><span>Kết luận bảo hành</span><textarea placeholder="Nhập nguyên nhân, phạm vi bảo hành hoặc lý do từ chối" maxLength={5000} value={note} onChange={event => setNote(event.target.value)} /></label>
    <div className="button-row"><button className="button button--primary" disabled={save.isPending || (remedy === 'REPLACEMENT' && !replacementId)} onClick={() => save.mutate('APPROVED')}>Chấp nhận bảo hành</button><button className="button button--secondary" disabled={save.isPending || !note.trim()} onClick={() => save.mutate('REJECTED')}>Không thuộc bảo hành</button></div>
    {save.isError && <ErrorState error={save.error} />}
  </div>
}
