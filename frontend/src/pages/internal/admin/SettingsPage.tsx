import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../../api/adminApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
const timingSettings = [
 { key: 'TECHNICIAN_BREAK_BETWEEN_JOBS_MINUTES', name: 'Thời gian nghỉ giữa hai thiết bị của kỹ thuật viên', value: '10', min: 0, description: 'Dùng khi tính hàng đợi. Kỹ thuật viên vẫn được bắt đầu sớm hơn; thời gian nghỉ không tính vào thời lượng sửa.' },
 { key: 'UNASSIGNED_TICKET_TARGET_MINUTES', name: 'Thời hạn phân công sau khi tiếp nhận', value: '15', min: 0, description: 'Hiển thị cảnh báo nếu nhân viên chưa phân công. Không tự phân công hoặc hủy phiếu.' },
 { key: 'DEFAULT_INSPECTION_ESTIMATE_MINUTES', name: 'Thời lượng dự kiến khi chưa xác định dịch vụ', value: '30', min: 1, description: 'Dự kiến tạm thời cho phiếu chưa có phương án; được tính lại sau kiểm tra.' },
]
export function SettingsPage() {
 const client = useQueryClient(); const [drafts, setDrafts] = useState<Record<string, string>>({}); const [saved, setSaved] = useState('')
 const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: ({ signal }) => adminApi.settings(signal) })
 const update = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value), onSuccess: async () => { setSaved('Đã lưu cấu hình. Áp dụng cho các lần tính dự kiến tiếp theo; lịch sử cũ được giữ nguyên.'); await client.invalidateQueries({ queryKey: ['admin', 'settings'] }) } })
 return <div className="workspace-page"><header><span className="eyebrow">Quản trị · Vận hành</span><h1>Thời gian & cấu hình</h1><p>Định mức dùng chung cho hàng đợi kỹ thuật viên. Các giá trị tính bằng phút, theo giờ Việt Nam.</p></header>
  {settings.isLoading ? <LoadingState /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : <div className="settings-list">{timingSettings.map(meta => {
   const stored = settings.data?.find(s => s.settingKey === meta.key)?.settingValue; const value = drafts[meta.key] ?? stored ?? meta.value; const number = Number(value)
   return <article key={meta.key}><div><strong>{meta.name}</strong><p>{meta.description}</p>{stored === undefined && <small>Đang dùng mặc định: {meta.value} phút</small>}</div><input type="number" min={meta.min} max="10080" step="1" aria-label={meta.name} placeholder="Nhập số phút" value={value} onChange={e => { setSaved(''); setDrafts(d => ({ ...d, [meta.key]: e.target.value })) }} /><button className="button button--primary" disabled={update.isPending || !value.trim() || !Number.isInteger(number) || number < meta.min || number > 10080 || value === stored} onClick={() => update.mutate({ key: meta.key, value })}>Lưu</button></article>
  })}{settings.data?.filter(s => !timingSettings.some(meta => meta.key === s.settingKey)).map(s => <article key={s.settingKey}><div><strong>{s.settingKey === 'ONLINE_DISCOUNT_PERCENT' ? 'Ưu đãi đặt lịch trực tuyến (%)' : s.settingKey}</strong><p>Cấu hình nghiệp vụ hiện có.</p></div><input aria-label={s.settingKey} placeholder="Nhập giá trị cấu hình" value={drafts[s.settingKey] ?? s.settingValue} onChange={e => setDrafts(d => ({ ...d, [s.settingKey]: e.target.value }))} /><button className="button button--primary" disabled={update.isPending || !drafts[s.settingKey] || drafts[s.settingKey] === s.settingValue} onClick={() => update.mutate({ key: s.settingKey, value: drafts[s.settingKey] })}>Lưu</button></article>)}</div>}
  {saved && <p role="status" className="phase-notice">{saved}</p>}{update.isError && <ErrorState error={update.error} />}
 </div>
}
