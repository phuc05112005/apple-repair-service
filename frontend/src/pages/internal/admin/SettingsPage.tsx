import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../../api/adminApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'

const settingMeta: Record<string, { name: string; description: string; group: string }> = {
  APPOINTMENT_DISCOUNT_PERCENT: { name: 'Ưu đãi đặt lịch', description: 'Tỷ lệ giảm giá áp dụng cho lịch hẹn hợp lệ.', group: 'Đặt lịch' },
}

function describeSetting(key: string) {
  return settingMeta[key] ?? {
    name: key.toLowerCase().replaceAll('_', ' ').replace(/^./, value => value.toUpperCase()),
    description: 'Giá trị cấu hình do hệ thống sử dụng.',
    group: 'Khác',
  }
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: ({ signal }) => adminApi.settings(signal) })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const update = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }) })
  return <div className="workspace-page"><header><span className="eyebrow">Quản trị · Cấu hình chung</span><h1>Thiết lập hệ thống</h1><p>Cập nhật các cấu hình hiện có. Cấu hình bắt buộc được bảo vệ và không thể xóa tại màn hình này.</p></header>{settings.isLoading ? <LoadingState /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : !settings.data?.length ? <EmptyState title="Chưa có thiết lập" /> : <div className="settings-list">{settings.data.map(setting => { const meta = describeSetting(setting.settingKey); return <article key={setting.id}><div><span className="eyebrow">{meta.group}</span><strong>{meta.name}</strong><p>{meta.description}</p><small>{setting.settingKey} · Cập nhật {new Date(setting.updatedAt).toLocaleString('vi-VN')}</small></div><input aria-label={`Giá trị ${meta.name}`} value={drafts[setting.settingKey] ?? setting.settingValue} onChange={event => setDrafts(current => ({ ...current, [setting.settingKey]: event.target.value }))} /><button className="button button--primary" disabled={update.isPending || (drafts[setting.settingKey] ?? setting.settingValue) === setting.settingValue} onClick={() => update.mutate({ key: setting.settingKey, value: drafts[setting.settingKey] ?? setting.settingValue })}>Lưu</button></article> })}</div>}{update.isError && <ErrorState error={update.error} />}</div>
}
