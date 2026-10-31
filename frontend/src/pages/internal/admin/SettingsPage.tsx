import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../../api/adminApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
interface SettingMetadata {
 key: string
 name: string
 value: string
 min: number
 max?: number
 suffix?: string
 description: string
}

const settingsMetadata: SettingMetadata[] = [
 { key: 'TECHNICIAN_BREAK_BETWEEN_JOBS_MINUTES', name: 'Thời gian nghỉ giữa hai thiết bị của kỹ thuật viên', value: '10', min: 0, description: 'Dùng khi tính hàng đợi. Kỹ thuật viên vẫn được bắt đầu sớm hơn; thời gian nghỉ không tính vào thời lượng kỹ thuật.' },
 { key: 'UNASSIGNED_TICKET_TARGET_MINUTES', name: 'Thời hạn phân công sau khi tiếp nhận', value: '15', min: 0, description: 'Hiển thị cảnh báo nếu nhân viên chưa phân công. Không tự phân công hoặc hủy phiếu.' },
 { key: 'ONLINE_BOOKING_DISCOUNT_PERCENT', name: 'Ưu đãi đặt lịch trực tuyến', value: '10', min: 0, max: 100, suffix: '%', description: 'Áp dụng cho lịch hẹn mới. Lịch đã đặt giữ nguyên tỷ lệ và giá được chụp tại thời điểm đặt.' },
]
export function SettingsPage() {
 const client = useQueryClient(); const [drafts, setDrafts] = useState<Record<string, string>>({}); const [saved, setSaved] = useState('')
 const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: ({ signal }) => adminApi.settings(signal) })
 const update = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value), onSuccess: async () => { setSaved('Đã lưu cấu hình. Áp dụng cho các lần tính dự kiến tiếp theo; lịch sử cũ được giữ nguyên.'); await client.invalidateQueries({ queryKey: ['admin', 'settings'] }) } })
 return <div className="workspace-page"><header><span className="eyebrow">Vận hành</span><h1>Thời gian & cấu hình</h1><p>Thiết lập hàng đợi kỹ thuật viên và chính sách đặt lịch. Thay đổi chỉ áp dụng cho dữ liệu phát sinh sau khi lưu.</p></header>
  {settings.isLoading ? <LoadingState /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : <div className="settings-list">{settingsMetadata.map(meta => {
   const stored = settings.data?.find(s => s.settingKey === meta.key)?.settingValue; const value = drafts[meta.key] ?? stored ?? meta.value; const number = Number(value)
   const max = meta.max ?? 10080
   return <article key={meta.key}><div><strong>{meta.name}</strong><p>{meta.description}</p>{stored === undefined && <small>Đang dùng mặc định: {meta.value}{meta.suffix ?? ' phút'}</small>}</div><div className="setting-input"><input type="number" min={meta.min} max={max} step="1" aria-label={meta.name} placeholder="Nhập giá trị" value={value} onChange={e => { setSaved(''); setDrafts(d => ({ ...d, [meta.key]: e.target.value })) }} />{meta.suffix && <span>{meta.suffix}</span>}</div><button className="button button--primary" disabled={update.isPending || !value.trim() || !Number.isInteger(number) || number < meta.min || number > max || value === stored} onClick={() => update.mutate({ key: meta.key, value })}>Lưu</button></article>
  })}</div>}
  {saved && <p role="status" className="phase-notice">{saved}</p>}{update.isError && <ErrorState error={update.error} />}
 </div>
}
