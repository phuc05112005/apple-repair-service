import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DateOverrideResponse, SlotRule, WeeklyScheduleResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast'
import { formatDate, formatTime } from '../../../utils/format'

const days = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']
const today = () => new Date().toISOString().slice(0, 10)
const newSlot = (): SlotRule => ({ startTime: '09:00', endTime: '10:00', enabled: true })

function RuleEditor({ slots, onChange }: { slots: SlotRule[]; onChange: (slots: SlotRule[]) => void }) {
  function edit(index: number, patch: Partial<SlotRule>) { onChange(slots.map((slot, i) => i === index ? { ...slot, ...patch } : slot)) }
  return <div className="schedule-rules">{slots.length === 0 && <p>Chưa có khung giờ. Thêm khung giờ để bắt đầu.</p>}{slots.map((slot, index) => <div className="schedule-rule" key={index}><label className="field"><span>Bắt đầu</span><input type="time" value={slot.startTime.slice(0, 5)} onChange={event => edit(index, { startTime: event.target.value })} /></label><label className="field"><span>Kết thúc</span><input type="time" value={slot.endTime.slice(0, 5)} onChange={event => edit(index, { endTime: event.target.value })} /></label><label className="check-option"><input type="checkbox" checked={slot.enabled} onChange={event => edit(index, { enabled: event.target.checked })} />Đang mở</label><button className="text-action text-action--danger" onClick={() => onChange(slots.filter((_, i) => i !== index))}>Xóa</button></div>)}<button className="button button--secondary" onClick={() => onChange([...slots, newSlot()])}>+ Thêm khung giờ</button></div>
}

export function SlotsPage() {
  const client = useQueryClient()
  const [branchId, setBranchId] = useState<number>()
  const [tab, setTab] = useState<'weekly' | 'date'>('weekly')
  const [weekday, setWeekday] = useState(1)
  const [copyTo, setCopyTo] = useState<number[]>([])
  const [date, setDate] = useState(today)
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyScheduleResponse>()
  const [mode, setMode] = useState<DateOverrideResponse['mode']>()
  const [dateSlots, setDateSlots] = useState<SlotRule[]>()
  const [toast, setToast] = useState<string>()
  const branches = useQuery({ queryKey: ['admin', 'branches'], queryFn: ({ signal }) => adminApi.branches(signal) })
  const selectedBranch = branchId ?? branches.data?.[0]?.id
  const weekly = useQuery({ queryKey: ['admin', 'weekly-schedules', selectedBranch], queryFn: ({ signal }) => adminApi.weeklySchedules(selectedBranch!, signal), enabled: Boolean(selectedBranch) })
  const override = useQuery({ queryKey: ['admin', 'date-override', selectedBranch, date], queryFn: ({ signal }) => adminApi.dateOverride(selectedBranch!, date, signal), enabled: Boolean(selectedBranch && date) })
  const slots = useQuery({ queryKey: ['admin', 'slots', selectedBranch, date], queryFn: ({ signal }) => adminApi.slots(selectedBranch!, date, signal), enabled: Boolean(selectedBranch && date && tab === 'date') })
  const template = useMemo(() => weekly.data?.find(item => item.weekday === weekday), [weekly.data, weekday])
  const activeWeek = weeklyDraft ?? template
  const day = new Date(`${date}T12:00:00`).getDay() || 7
  const baseSlots = weekly.data?.find(item => item.weekday === day)?.slots ?? []
  const activeMode = mode ?? override.data?.mode ?? 'INHERIT'
  const activeDateSlots = dateSlots ?? (override.data?.mode === 'REPLACE' ? override.data.slots : baseSlots)
  const saveWeek = useMutation({ mutationFn: async () => {
    if (!activeWeek) return
    await adminApi.saveWeekdays([weekday, ...copyTo].map(targetDay => ({ ...activeWeek, branchId: selectedBranch!, weekday: targetDay })))
  }, onSuccess: async () => { setWeeklyDraft(undefined); setToast('Đã lưu lịch tuần.'); await client.invalidateQueries({ queryKey: ['admin', 'weekly-schedules', selectedBranch] }); await client.invalidateQueries({ queryKey: ['admin', 'slots', selectedBranch] }) } })
  const saveDate = useMutation({ mutationFn: () => adminApi.saveDateOverride({ branchId: selectedBranch!, date, mode: activeMode, slots: activeMode === 'REPLACE' ? activeDateSlots : [] }), onSuccess: async () => { setMode(undefined); setDateSlots(undefined); setToast('Đã lưu điều chỉnh ngày.'); await client.invalidateQueries({ queryKey: ['admin', 'date-override', selectedBranch, date] }); await client.invalidateQueries({ queryKey: ['admin', 'slots', selectedBranch, date] }) } })
  const valid = (rules: SlotRule[]) => rules.every(rule => rule.startTime && rule.endTime && rule.startTime < rule.endTime) && new Set(rules.map(rule => `${rule.startTime}/${rule.endTime}`)).size === rules.length

  return <div className="workspace-page admin-resource-page"><header className="admin-page-header"><div><span className="eyebrow">Danh mục</span><h1>Quản lý khung giờ & lịch hẹn</h1><p>Lọc theo chi nhánh, ngày và theo dõi số lượt đã đặt thực tế.</p></div></header>
    <div className="context-filters"><label className="field"><span>Chi nhánh</span><select value={selectedBranch ?? ''} onChange={event => { setBranchId(Number(event.target.value)); setWeeklyDraft(undefined); setMode(undefined); setDateSlots(undefined) }}>{branches.data?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
    <div className="segmented" role="tablist" aria-label="Cấu hình khung giờ"><button role="tab" aria-selected={tab === 'weekly'} className={tab === 'weekly' ? 'active' : ''} onClick={() => setTab('weekly')}>Lịch lặp theo tuần</button><button role="tab" aria-selected={tab === 'date'} className={tab === 'date' ? 'active' : ''} onClick={() => setTab('date')}>Điều chỉnh theo ngày</button></div>
    {branches.isLoading || weekly.isLoading ? <LoadingState /> : branches.isError || weekly.isError ? <ErrorState error={branches.error ?? weekly.error} retry={() => { branches.refetch(); weekly.refetch() }} /> : tab === 'weekly' && activeWeek ? <section className="ops-section"><div className="ops-section__title"><span>01</span><h2>Khung giờ hằng tuần</h2></div><div className="weekday-tabs">{days.map((label, index) => <button key={label} className={weekday === index + 1 ? 'active' : ''} onClick={() => { setWeekday(index + 1); setWeeklyDraft(undefined); setCopyTo([]) }}>{label}<small>{weekly.data?.[index]?.enabled ? `${weekly.data[index].slots.filter(slot => slot.enabled).length} khung` : 'Đã tắt'}</small></button>)}</div><label className="check-option"><input type="checkbox" checked={activeWeek.enabled} onChange={event => setWeeklyDraft({ ...activeWeek, enabled: event.target.checked })} />Mở lịch cho {days[weekday - 1].toLowerCase()}</label><RuleEditor slots={activeWeek.slots} onChange={rules => setWeeklyDraft({ ...activeWeek, slots: rules })} /><div className="schedule-copy"><strong>Áp dụng cấu hình này cho ngày khác</strong><div>{days.map((label, index) => index + 1 === weekday ? null : <label key={label} className="check-option"><input type="checkbox" checked={copyTo.includes(index + 1)} onChange={event => setCopyTo(value => event.target.checked ? [...value, index + 1] : value.filter(day => day !== index + 1))} />{label}</label>)}</div></div><button className="button button--primary" disabled={saveWeek.isPending || !valid(activeWeek.slots)} onClick={() => saveWeek.mutate()}>{saveWeek.isPending ? 'Đang lưu…' : 'Lưu lịch tuần'}</button>{saveWeek.isError && <ErrorState error={saveWeek.error} />}</section> : tab === 'date' ? <section className="ops-section"><div className="ops-section__title"><span>02</span><h2>Điều chỉnh riêng một ngày</h2></div><label className="field"><span>Ngày cần điều chỉnh</span><input type="date" value={date} onChange={event => { setDate(event.target.value); setMode(undefined); setDateSlots(undefined) }} /></label>{override.isLoading ? <LoadingState /> : override.isError ? <ErrorState error={override.error} retry={() => override.refetch()} /> : <><label className="field"><span>Áp dụng</span><select value={activeMode} onChange={event => setMode(event.target.value as DateOverrideResponse['mode'])}><option value="INHERIT">Theo lịch tuần</option><option value="DISABLED">Đóng cả ngày</option><option value="REPLACE">Thay khung giờ riêng cho ngày này</option></select></label>{activeMode === 'REPLACE' && <RuleEditor slots={activeDateSlots} onChange={setDateSlots} />}<button className="button button--primary" disabled={saveDate.isPending || (activeMode === 'REPLACE' && !valid(activeDateSlots))} onClick={() => saveDate.mutate()}>{saveDate.isPending ? 'Đang lưu…' : 'Lưu điều chỉnh ngày'}</button>{saveDate.isError && <ErrorState error={saveDate.error} />}</>}<div className="detail-section"><h3>Khung giờ thực tế · {formatDate(date)}</h3>{slots.isLoading ? <LoadingState /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : slots.data?.length ? <div className="appointment-list">{slots.data.map(slot => <article key={slot.slotId}><strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong><span>{slot.activeBookingCount} lượt đã đặt</span><StatusBadge label={slot.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'} tone={slot.status === 'OPEN' ? 'success' : 'warning'} /></article>)}</div> : <p>Chưa có khung giờ trong ngày đã chọn.</p>}</div></section> : null}
    {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
  </div>
}
