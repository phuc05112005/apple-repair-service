import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { adminApi } from '../../../api/adminApi'
import { publicApi } from '../../../api/publicApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { ticketStatusLabels } from '../../../types/labels'
import { addBusinessDays, businessDate, formatMoney } from '../../../utils/format'

export function StatisticsPage() {
  const initial = useMemo(() => {
    const to = businessDate()
    return { from: addBusinessDays(to, -30), to }
  }, [])
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [branchId, setBranchId] = useState<number>()
  const [deviceTypeId, setDeviceTypeId] = useState<number>()
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal) })
  const deviceTypes = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const statistics = useQuery({ queryKey: ['admin', 'statistics', from, to, branchId, deviceTypeId], queryFn: ({ signal }) => adminApi.statistics({ from, to, branchId, deviceTypeId }, signal), enabled: Boolean(from && to) })
  const feedback = useQuery({ queryKey: ['admin', 'feedback-statistics', from, to], queryFn: ({ signal }) => adminApi.feedbackStatistics({ from, to }, signal), enabled: Boolean(from && to) })
  const branchName = branches.data?.find(branch => branch.id === branchId)?.name ?? 'Tất cả chi nhánh'

  return <div className="workspace-page">
    <header><span className="eyebrow">Tổng quan</span><h1>Thống kê &amp; báo cáo</h1><p>Theo dõi số liệu vận hành theo chi nhánh, khoảng thời gian và loại thiết bị.</p></header>
    <div className="branch-context"><span>Chi nhánh đang xem</span><strong>{branchName}</strong></div>
    <div className="toolbar toolbar--four"><label><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Tất cả chi nhánh</option>{branches.data?.map(branch => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label><label><span>Từ ngày</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>Đến ngày</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label><span>Loại thiết bị</span><select value={deviceTypeId ?? ''} onChange={event => setDeviceTypeId(Number(event.target.value) || undefined)}><option value="">Tất cả loại</option>{deviceTypes.data?.map(type => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label></div>
    {statistics.isLoading ? <LoadingState /> : statistics.isError ? <ErrorState error={statistics.error} retry={() => statistics.refetch()} /> : statistics.data && <>
      <div className="metric-grid"><article><span>Tổng phiếu</span><strong>{statistics.data.totalTickets}</strong><small>Trong kỳ đã chọn</small></article><article><span>Doanh thu đã thanh toán</span><strong>{formatMoney(statistics.data.paidRevenue)}</strong><small>Chỉ tính khoản đã ghi nhận</small></article><article><span>Phiếu bảo hành quay lại</span><strong>{statistics.data.warrantyReturnTickets}</strong><small>Theo phiếu dịch vụ</small></article>{feedback.data && <><article><span>Tổng phản hồi</span><strong>{feedback.data.total}</strong><small>Trong kỳ đã chọn</small></article><article><span>Mức hài lòng</span><strong>{Math.round(feedback.data.satisfactionRate * 100)}%</strong><small>{feedback.data.satisfied} hài lòng · {feedback.data.dissatisfied} chưa hài lòng</small></article></>}</div>
      <section className="ops-section"><div className="ops-section__title"><span>01</span><h2>Trạng thái hiện tại</h2></div><div className="status-bars">{statistics.data.currentStatusCounts.map(item => <div key={item.status}><span>{ticketStatusLabels[item.status]}</span><div><i style={{ width: `${statistics.data.totalTickets ? Math.max(2, item.count / statistics.data.totalTickets * 100) : 0}%` }} /></div><strong>{item.count}</strong></div>)}</div></section>
      <section className="ops-section"><div className="ops-section__title"><span>02</span><h2>Phản hồi theo chi nhánh</h2></div>{feedback.isLoading ? <LoadingState label="Đang tải phản hồi…" /> : feedback.isError ? <ErrorState error={feedback.error} retry={() => feedback.refetch()} /> : feedback.data?.branches.length === 0 ? <p>Chưa có dữ liệu phản hồi trong khoảng thời gian đã chọn.</p> : feedback.data && <div className="table-wrap"><table><thead><tr><th>Chi nhánh</th><th>Tổng phản hồi</th><th>Hài lòng</th><th>Chưa hài lòng</th><th>Tỷ lệ hài lòng</th></tr></thead><tbody>{feedback.data.branches.map(branch => <tr key={branch.branchId}><td>{branch.branchName}</td><td>{branch.total}</td><td>{branch.satisfied}</td><td>{branch.dissatisfied}</td><td>{Math.round(branch.satisfactionRate * 100)}%</td></tr>)}</tbody></table></div>}</section>
    </>}
  </div>
}
