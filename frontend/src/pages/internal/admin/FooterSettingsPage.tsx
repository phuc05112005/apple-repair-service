import { useState } from 'react'
import { useSystemSettings, SystemSettings, BranchSetting } from '../../../hooks/useSystemSettings'

export function FooterSettingsPage() {
  const { settings, updateSettings } = useSystemSettings()
  const [formData, setFormData] = useState<SystemSettings>(settings)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleAddBranch = () => {
    const newBranch: BranchSetting = {
      id: `branch-${Date.now()}`,
      name: `Chi nhánh ${formData.branches.length + 1}`,
      address: '',
      phone: '',
      workingHours: '08:00 - 21:00 (Tất cả các ngày)',
    }
    setFormData({ ...formData, branches: [...formData.branches, newBranch] })
  }

  const handleRemoveBranch = (id: string) => {
    if (formData.branches.length <= 1) return
    setFormData({
      ...formData,
      branches: formData.branches.filter((b) => b.id !== id),
    })
  }

  const handleBranchChange = (id: string, field: keyof BranchSetting, value: string) => {
    setFormData({
      ...formData,
      branches: formData.branches.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings(formData)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="workspace-page workspace-page--focused">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Vận hành</span>
          <h1>Thông tin hệ thống</h1>
          <p>Thiết lập thông tin thương hiệu, hình ảnh logo, tổng đài và danh sách chi nhánh kèm giờ làm việc riêng biệt.</p>
        </div>
      </header>

      {savedSuccess && (
        <div className="auth-notice" style={{ background: '#e9f5ed', borderColor: '#237a4a', color: '#1c6a3e' }}>
          Đã lưu cấu hình Logo, Hotline & Chi nhánh thành công!
        </div>
      )}

      <form className="ops-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <span className="eyebrow">Thông tin liên hệ</span>
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            
            <label className="field">
              <span>Hotline hỗ trợ</span>
              <input
                type="text"
                value={formData.hotline}
                onChange={(e) => setFormData({ ...formData, hotline: e.target.value })}
                placeholder="VD: 1900 1234"
                required
              />
            </label>

            <label className="field">
              <span>Số Zalo tư vấn</span>
              <input
                type="text"
                value={formData.zaloPhone}
                onChange={(e) => setFormData({ ...formData, zaloPhone: e.target.value })}
                placeholder="VD: 0901234567"
                required
              />
            </label>

            <label className="field">
              <span>Email hỗ trợ</span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Giờ trực tổng đài chung</span>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                required
              />
            </label>

            <label className="field form-note--wide">
              <span>Mô tả ngắn ở Chân trang</span>
              <textarea
                rows={3}
                value={formData.footerDesc}
                onChange={(e) => setFormData({ ...formData, footerDesc: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="branches-editor-section">
          <div className="branches-editor-header">
            <div>
              <span className="eyebrow">Thông tin chi nhánh </span>
              <p className="form-hint">Nhập thông tin địa chỉ, SĐT và giờ làm việc cụ thể của từng địa điểm.</p>
            </div>
            <button type="button" className="button button--secondary" onClick={handleAddBranch}>
              + Thêm chi nhánh
            </button>
          </div>

          <div className="branches-editor-grid">
            {formData.branches.map((branch, index) => (
              <div key={branch.id} className="branch-editor-card">
                <div className="branch-editor-card__head">
                  <strong>Chi nhánh #{index + 1}</strong>
                  {formData.branches.length > 1 && (
                    <button
                      type="button"
                      className="text-action text-action--danger"
                      onClick={() => handleRemoveBranch(branch.id)}
                    >
                      Xóa chi nhánh này
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Tên chi nhánh</span>
                    <input
                      type="text"
                      value={branch.name}
                      onChange={(e) => handleBranchChange(branch.id, 'name', e.target.value)}
                      placeholder="VD: Chi nhánh Quận 1"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>SĐT liên hệ trực tiếp</span>
                    <input
                      type="text"
                      value={branch.phone}
                      onChange={(e) => handleBranchChange(branch.id, 'phone', e.target.value)}
                      placeholder="VD: 028 7300 1234"
                      required
                    />
                  </label>

                  <label className="field form-note--wide">
                    <span>Giờ làm việc riêng của chi nhánh</span>
                    <input
                      type="text"
                      value={branch.workingHours}
                      onChange={(e) => handleBranchChange(branch.id, 'workingHours', e.target.value)}
                      placeholder="VD: 08:00 - 21:00 (Tất cả các ngày)"
                      required
                    />
                  </label>

                  <label className="field form-note--wide">
                    <span>Địa chỉ chi nhánh</span>
                    <input
                      type="text"
                      value={branch.address}
                      onChange={(e) => handleBranchChange(branch.id, 'address', e.target.value)}
                      placeholder="VD: 123 Nguyễn Thị Minh Khai, P. Bến Thành, Q.1, TP.HCM"
                      required
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="panel-actions">
          <button type="submit" className="button button--primary button--large">
            Lưu thay đổi cấu hình
          </button>
        </div>
      </form>
    </div>
  )
}