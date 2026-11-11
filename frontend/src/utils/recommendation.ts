import type { TechnicianRecommendationResponse } from '../api/contracts'

export const predictionSourceLabel = (source: TechnicianRecommendationResponse['predictionSource']) =>
  source === 'ML'
    ? 'Dự đoán theo mô hình'
    : 'Định mức tiêu chuẩn'

export function predictionWarningLabel(code: string): string | null {
  // 1. Cảnh báo Cold-Start & Ngoại lệ từ Python ML API
  if (code === 'UNKNOWN_TECHNICIAN') return 'Kỹ thuật viên mới (Chưa có lịch sử làm ca, áp dụng định mức chuẩn).'
  if (code === 'UNKNOWN_SERVICE_ISSUE') return 'Mã lỗi / Dịch vụ mới (Chưa từng có trong dữ liệu học ML).'
  if (code === 'UNKNOWN_DEVICE_MODEL') return 'Đời máy mới (Chưa có dữ liệu tháo lắp trong tập học ML).'
  if (code === 'CATALOG_OUT_OF_BOUNDS') return 'Thời lượng ngoài ngưỡng ML dự đoán (<30p hoặc >225p).'
  if (code === 'TOO_MANY_SERVICES') return 'Ca ghép >= 4 dịch vụ (Ưu tiên dùng định mức tiêu chuẩn).'
  if (code === 'NO_REPAIR_ITEMS') return 'Phiếu chưa chọn hạng mục sửa chữa.'

  // 2. Cảnh báo Phân luồng & Hệ thống từ Spring Boot
  if (code === 'MISSING_ML_CANDIDATE') return 'Chưa có dữ liệu KTV này trong mô hình; đang dùng định mức chuẩn.'
  if (code === 'UNSUPPORTED_PREDICTION_CONTEXT') return 'Phiếu nằm ngoài phạm vi ML; tính theo định mức dịch vụ.'
  if (code === 'ML_DISABLED') return 'Dịch vụ ML tạm tắt; hệ thống tính theo định mức.'
  if (/^(ML_|MODEL_|CONNECTION_|DATABASE_|INVALID_|MALFORMED_)/.test(code)) return 'Dịch vụ ML chưa sẵn sàng; đã chuyển sang định mức chuẩn.'

  return null
}

export const canAssignCandidate = (candidate: Pick<TechnicianRecommendationResponse, 'eligible' | 'estimatedCompletionAt'>) =>
  candidate.eligible && candidate.estimatedCompletionAt !== null