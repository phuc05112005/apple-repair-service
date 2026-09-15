import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../../../api/adminApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: ({ signal }) => adminApi.settings(signal) })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const update = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }) })
  return <div className="workspace-page"><header><span className="eyebrow">Admin · Global master data</span><h1>Thiết lập hệ thống</h1><p>Chỉ cập nhật các key backend đã tồn tại; màn hình không tạo hoặc xóa setting.</p></header>{settings.isLoading ? <LoadingState /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : !settings.data?.length ? <EmptyState title="Chưa có thiết lập" /> : <div className="settings-list">{settings.data.map(setting => <article key={setting.id}><div><span>{setting.settingKey}</span><small>Cập nhật {new Date(setting.updatedAt).toLocaleString('vi-VN')}</small></div><input aria-label={`Giá trị ${setting.settingKey}`} value={drafts[setting.settingKey] ?? setting.settingValue} onChange={event => setDrafts(current => ({ ...current, [setting.settingKey]: event.target.value }))} /><button className="button button--primary" disabled={update.isPending || (drafts[setting.settingKey] ?? setting.settingValue) === setting.settingValue} onClick={() => update.mutate({ key: setting.settingKey, value: drafts[setting.settingKey] ?? setting.settingValue })}>Lưu</button></article>)}</div>}{update.isError && <ErrorState error={update.error} />}</div>
}
