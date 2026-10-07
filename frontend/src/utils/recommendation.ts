import type { TechnicianRecommendationResponse } from '../api/contracts'

export const predictionSourceLabel = (source: TechnicianRecommendationResponse['predictionSource']) => source === 'ML'
  ? 'Dự đoán theo mô hình'
  : 'Ước tính theo thời gian chuẩn'

export function predictionWarningLabel(code: string): string | null {
  if (code === 'UNSEEN_CATALOG_CATEGORY') return 'Ước tính sử dụng danh mục dịch vụ mới.'
  if (code === 'COLD_START_TECHNICIAN') return 'Kỹ thuật viên chưa có nhiều lịch sử xử lý tương tự.'
  if (code === 'MISSING_ML_CANDIDATE') return 'Chưa có dự đoán riêng cho kỹ thuật viên này; đang dùng thời gian chuẩn.'
  if (code === 'UNSUPPORTED_PREDICTION_CONTEXT') return 'Phiếu này đang được ước tính theo định mức dịch vụ.'
  if (code === 'ML_DISABLED') return 'Dịch vụ dự đoán đang tắt; hệ thống vẫn tính theo định mức.'
  if (/^(ML_|MODEL_|CONNECTION_|DATABASE_|INVALID_|MALFORMED_)/.test(code)) return 'Dịch vụ dự đoán tạm thời chưa sẵn sàng; hệ thống đã dùng thời gian chuẩn.'
  return null
}

export const canAssignCandidate = (candidate: Pick<TechnicianRecommendationResponse, 'eligible' | 'estimatedCompletionAt'>) =>
  candidate.eligible && candidate.estimatedCompletionAt !== null

