import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { BranchResponse, UserResponse } from '../../../api/contracts'
import { adminApi } from '../../../api/adminApi'
import { DetailDrawer } from '../../../components/Dialog'
import { ErrorState } from '../../../components/AsyncState'
import { deselectAllEligible, removeSavedSelections, selectAllEligible, toggleSelection } from '../../../utils/technicianSelection'

type SaveResult = { id: number; name: string; ok: boolean; message: string }

export function BulkTechnicianScheduleDrawer({
  date, branches, users, onClose, onSaved,
}: {
  date: string
  branches: BranchResponse[]
  users: UserResponse[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [branchId, setBranchId] = useState<number | undefined>(branches[0]?.id)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<SaveResult[]>()
  const technicians = useMemo(() => users.filter(user => user.role === 'TECHNICIAN'), [users])
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    return technicians.filter(user => !query || `${user.fullName} ${user.username}`.toLocaleLowerCase('vi').includes(query))
  }, [technicians, search])
  const eligibleVisible = visible.filter(user => user.status === 'ACTIVE')
  const toggle = (id: number) => setSelected(previous => toggleSelection(previous, id))
  const save = useMutation({
    mutationFn: async () => {
      const targets = technicians.filter(user => selected.has(user.id) && user.status === 'ACTIVE')
      const settled = await Promise.allSettled(targets.map(user => adminApi.saveSchedule(undefined, {
        technicianId: user.id, branchId: branchId!, workDate: date, startTime, endTime, status: 'WORKING',
      })))
      const next = settled.map((outcome, index): SaveResult => ({
        id: targets[index].id,
        name: targets[index].fullName,
        ok: outcome.status === 'fulfilled',
        message: outcome.status === 'fulfilled' ? 'Đã lưu ca làm việc.' : 'Không thể lưu ca. Kiểm tra lịch trùng hoặc trạng thái nhân viên.',
      }))
      setResults(next)
      setSelected(previous => removeSavedSelections(previous, next))
      await onSaved()
      return next
    },
  })
  const canSave = Boolean(branchId && date && startTime < endTime && selected.size && !save.isPending)
  return <DetailDrawer eyebrow="Xếp lịch theo ca" title="Chọn ca trước, chọn kỹ thuật viên sau" onClose={onClose} footer={<><button className="button button--quiet" disabled={save.isPending} onClick={onClose}>Đóng</button><button className="button button--primary" disabled={!canSave} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : `Lưu lịch cho ${selected.size} KTV`}</button></>}>
    <div className="drawer-form bulk-schedule">
      <p className="form-note">Ngày và khung giờ được áp dụng một lần cho các kỹ thuật viên đã chọn. Mỗi ca vẫn được kiểm tra xung đột ở backend trước khi lưu.</p>
      <div className="form-grid"><label className="field"><span>Ngày làm việc</span><input type="date" value={date} readOnly /></label><label className="field"><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Chọn chi nhánh</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="field"><span>Bắt đầu</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label className="field"><span>Kết thúc</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>
      <label className="field"><span>Tìm kỹ thuật viên</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên hoặc tài khoản kỹ thuật viên" /></label>
      <div className="bulk-schedule__toolbar"><strong>{selected.size} kỹ thuật viên đã chọn</strong><button type="button" className="text-action" onClick={() => setSelected(previous => selectAllEligible(previous, eligibleVisible.map(user => user.id)))}>Chọn tất cả đang hiển thị</button><button type="button" className="text-action" onClick={() => setSelected(previous => deselectAllEligible(previous, eligibleVisible.map(user => user.id)))}>Bỏ chọn đang hiển thị</button></div>
      <div className="bulk-schedule__list">{visible.map(user => <label key={user.id} className={`bulk-schedule__person ${user.status !== 'ACTIVE' ? 'is-disabled' : ''}`}><input type="checkbox" checked={selected.has(user.id)} disabled={user.status !== 'ACTIVE'} onChange={() => toggle(user.id)} /><span><strong>{user.fullName}</strong><small>{user.username} · {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}</small></span></label>)}</div>
      {results && <section className="bulk-schedule__results"><strong>Kết quả lưu lịch</strong>{results.map(result => <p key={result.id} className={result.ok ? 'is-success' : 'is-error'}>{result.name}: {result.message}</p>)}</section>}
      {save.isError && <ErrorState error={save.error} />}
    </div>
  </DetailDrawer>
}
