import type { ConfirmationMethod } from '../api/contracts'

import { confirmationLabels } from '../types/labels'

export function ConfirmationFields({ method, note, scope, onMethod, onNote }: {
  method: ConfirmationMethod | ''; note: string; scope?: string | null
  onMethod: (value: ConfirmationMethod | '') => void; onNote: (value: string) => void
}) {
  return <div className="confirmation-fields">
    {scope && <div className="detail-note"><span>Phạm vi khách đã cho phép</span><p>{scope}</p></div>}
    <div className="form-grid">
      <label className="field"><span>Hình thức ghi nhận ý kiến khách</span><select value={method} onChange={event => onMethod(event.target.value as ConfirmationMethod | '')}>
        <option value="">Chọn hình thức xác nhận</option>
        {Object.entries(confirmationLabels).map(([value, label]) => <option key={value} value={value} disabled={value === 'PRE_AUTHORIZED' && !scope}>{label}</option>)}
      </select></label>
      <label className="field"><span>Nội dung đã trao đổi</span><textarea placeholder="Nhập phương án, giá và ý kiến khách hàng" maxLength={5000} value={note} onChange={event => onNote(event.target.value)} /></label>
    </div>
    <small>Nhân viên ghi nhận nội bộ. Khách không cần đăng nhập hoặc xác nhận trên website.</small>
  </div>
}
