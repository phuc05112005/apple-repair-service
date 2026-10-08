import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../../api/adminApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'

function MlMonitoringPageLegacy() {
  const query = useQuery({ queryKey: ['admin', 'ml-overview'], queryFn: ({ signal }) => adminApi.mlOverview(signal) })
  if (query.isLoading) return <div className="workspace-page"><LoadingState /></div>
  if (query.isError) return <div className="workspace-page"><ErrorState error={query.error} retry={() => query.refetch()} /></div>
  const data = query.data!
  return <div className="workspace-page"><header><span className="eyebrow">Mô hình & dữ liệu</span><h1>Giám sát dự đoán kỹ thuật</h1><p>Thông tin vận hành và mức độ sẵn sàng dữ liệu được đọc trực tiếp từ hệ thống.</p></header><div className="metric-grid"><article><span>Trạng thái dịch vụ</span><strong>{data.enabled ? 'Đã cấu hình' : 'Đang tắt'}</strong><small>{data.status}</small></article><article><span>Số bản ghi dự đoán</span><strong>{data.predictionCount}</strong><small>Chỉ technical duration</small></article><article><span>Có thời lượng thực tế</span><strong>{data.recordsWithActualDuration}</strong><small>Không dùng ETA làm nhãn</small></article><article><span>Đủ điều kiện huấn luyện</span><strong>{data.trainingEligibleRecords}</strong><small>{data.trainingEligibleRecords ? 'Cần review trước khi train' : 'Chưa đủ dữ liệu thật'}</small></article></div><section className="ops-section"><div className="ops-section__title"><span>ML</span><h2>Thông tin artifact</h2></div><dl className="detail-list"><div><dt>Mô hình</dt><dd>{data.modelName}</dd></div><div><dt>Phiên bản</dt><dd>{data.modelVersion}</dd></div><div><dt>Feature contract</dt><dd>{data.featureContractVersion}</dd></div><div><dt>Khoảng dữ liệu dự đoán</dt><dd>{data.dataFrom && data.dataTo ? `${data.dataFrom} – ${data.dataTo}` : 'Chưa có dữ liệu'}</dd></div></dl></section><p className="muted">Mô hình hiện là bản thử nghiệm huấn luyện bằng dữ liệu synthetic; hệ thống không tự động retrain và không tự động phân công kỹ thuật viên.</p></div>
}

export function MlMonitoringPage() {
  const query = useQuery({ queryKey: ['admin', 'ml-overview', 'health'], queryFn: ({ signal }) => adminApi.mlOverview(signal) })
  if (query.isLoading) return <MlMonitoringPageLegacy />
  if (query.isError) return <MlMonitoringPageLegacy />
  const data = query.data!
  return <><MlMonitoringPageLegacy /><section className="workspace-page ops-section"><div className="ops-section__title"><span>API</span><h2>Trạng thái dịch vụ dự đoán</h2></div><div className="metric-grid"><article><span>Health</span><strong>{data.health}</strong></article><article><span>Readiness</span><strong>{data.readiness}</strong></article></div>{data.predictionCount === 0 && <p>Chưa có dữ liệu dự đoán thực tế trong hệ thống.</p>}</section></>
}
