import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../../api/adminApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'

export function MlMonitoringPage() {
  const query = useQuery({ queryKey: ['admin', 'ml-overview'], queryFn: ({ signal }) => adminApi.mlOverview(signal) })
  if (query.isLoading) return <div className="workspace-page"><LoadingState label="Đang tải thông tin mô hình…" /></div>
  if (query.isError) return <div className="workspace-page"><ErrorState error={query.error} retry={() => query.refetch()} /></div>
  const data = query.data!
  const noOperationalPredictions = data.predictionCount === 0
  return <div className="workspace-page">
    <header><span className="eyebrow">Mô hình &amp; dữ liệu</span><h1>Giám sát dự đoán kỹ thuật</h1><p>Dữ liệu vận hành được đọc trực tiếp từ hệ thống; benchmark synthetic không được tính vào các chỉ số này.</p></header>
    <div className="metric-grid"><article><span>Trạng thái mô hình</span><strong>{data.enabled ? 'Đã cấu hình' : 'Đang tắt'}</strong><small>{data.status}</small></article><article><span>Dịch vụ suy luận</span><strong>{data.health}</strong><small>Health</small></article><article><span>Sẵn sàng phục vụ</span><strong>{data.readiness}</strong><small>Readiness</small></article><article><span>Dự đoán vận hành</span><strong>{data.predictionCount}</strong><small>Chỉ dự đoán thời lượng kỹ thuật</small></article><article><span>Có thời lượng thực tế</span><strong>{data.recordsWithActualDuration}</strong><small>Không dùng ETA làm nhãn</small></article><article><span>Sẵn sàng dữ liệu train</span><strong>{data.trainingEligibleRecords}</strong><small>{data.trainingEligibleRecords ? 'Cần review trước khi train' : 'Chưa đủ dữ liệu thực tế'}</small></article></div>
    <section className="ops-section"><div className="ops-section__title"><span>ML</span><h2>Thông tin artifact</h2></div><dl className="detail-list"><div><dt>Mô hình</dt><dd>{data.modelName}</dd></div><div><dt>Phiên bản</dt><dd>{data.modelVersion}</dd></div><div><dt>Feature contract</dt><dd>{data.featureContractVersion}</dd></div><div><dt>Khoảng dữ liệu dự đoán</dt><dd>{data.dataFrom && data.dataTo ? `${data.dataFrom} – ${data.dataTo}` : 'Chưa có dữ liệu'}</dd></div></dl></section>
    {noOperationalPredictions && <section className="ops-section"><div className="ops-section__title"><span>0</span><h2>Chưa có dữ liệu vận hành</h2></div><p>Chưa có dữ liệu dự đoán thực tế hoặc thời lượng kỹ thuật thực tế để đánh giá mô hình. Đây không phải lỗi tài nguyên.</p></section>}
    <p className="muted">Mô hình hiện là bản thử nghiệm huấn luyện bằng dữ liệu synthetic, chưa được xác nhận production. Hệ thống không tự retrain hoặc tự động phân công kỹ thuật viên.</p>
  </div>
}
