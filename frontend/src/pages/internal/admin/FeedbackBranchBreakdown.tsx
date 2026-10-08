import type { FeedbackBranchStatisticsResponse } from '../../../api/contracts'

export function FeedbackBranchBreakdown({ branches }: { branches: FeedbackBranchStatisticsResponse[] }) {
  return <section className="ops-section feedback-analytics"><div className="ops-section__title"><span>02</span><h2>Phản hồi theo chi nhánh</h2></div>{branches.length === 0 ? <p>Chưa có dữ liệu phản hồi theo chi nhánh trong khoảng thời gian đã chọn.</p> : <div className="table-wrap"><table><thead><tr><th>Chi nhánh</th><th>Tổng</th><th>Hài lòng</th><th>Chưa hài lòng</th><th>Tỷ lệ</th></tr></thead><tbody>{branches.map(branch => <tr key={branch.branchId}><td>{branch.branchName}</td><td>{branch.total}</td><td>{branch.satisfied}</td><td>{branch.dissatisfied}</td><td>{Math.round(branch.satisfactionRate * 100)}%</td></tr>)}</tbody></table></div>}</section>
}
