import { useState } from 'react'
import { useSystemSettings, SystemSettings, BranchSetting } from '../../../hooks/useSystemSettings'

export function FooterSettingsPage() {
  const { settings, updateSettings, loading } = useSystemSettings()
  const [draft, setDraft] = useState<SystemSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const formData = draft ?? settings

  const updateDraft = (updater: (current: SystemSettings) => SystemSettings) => {
    setDraft((prev) => updater(prev ?? settings))
  }

  const handleAddBranch = () => {
    updateDraft((current) => {
      const newBranch: BranchSetting = {
        id: `branch-${Date.now()}`,
        name: `Chi nhánh ${current.branches.length + 1}`,
        address: '',
        phone: '',
        workingHours: current.workingHours || '',
      }
      return { ...current, branches: [...current.branches, newBranch] }
    })
  }

  const handleRemoveBranch = (id: string) => {
    updateDraft((current) => {
      if (current.branches.length <= 1) return current
      return {
        ...current,
        branches: current.branches.filter((b) => b.id !== id),
      }
    })
  }

  const handleBranchChange = (id: string, field: keyof BranchSetting, value: string) => {
    updateDraft((current) => ({
      ...current,
      branches: current.branches.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)
    setErrorMessage(null)

    try {
      await updateSettings(formData)
      setDraft(null)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Lưu cấu hình thất bại, vui lòng thử lại.'
      )
    } finally {
      setSaving(false)
    }
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

      {errorMessage && (
        <div className="auth-notice" style={{ background: '#fdecec', borderColor: '#c93b3b', color: '#991b1b' }}>
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="ops-form">
          <p className="form-hint">Đang tải thông tin cấu hình hiện tại của hệ thống...</p>
        </div>
      ) : (
        <form className="ops-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <span className="eyebrow">Thông tin liên hệ</span>
            <div className="form-grid" style={{ marginTop: '1rem' }}>
              <label className="field">
                <span>Hotline hỗ trợ</span>
                <input
                  type="text"
                  value={formData.hotline}
                  onChange={(e) => updateDraft((cur) => ({ ...cur, hotline: e.target.value }))}
                  placeholder="Nhập số hotline hỗ trợ"
                  required
                />
              </label>

              <label className="field">
                <span>Số Zalo tư vấn</span>
                <input
                  type="text"
                  value={formData.zaloPhone}
                  onChange={(e) => updateDraft((cur) => ({ ...cur, zaloPhone: e.target.value }))}
                  placeholder="Nhập số điện thoại Zalo"
                  required
                />
              </label>

              <label className="field">
                <span>Email hỗ trợ</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateDraft((cur) => ({ ...cur, email: e.target.value }))}
                  placeholder="Nhập email hỗ trợ"
                  required
                />
              </label>

              <label className="field">
                <span>Giờ trực tổng đài chung</span>
                <input
                  type="text"
                  value={formData.workingHours}
                  onChange={(e) => updateDraft((cur) => ({ ...cur, workingHours: e.target.value }))}
                  placeholder="Nhập khung giờ làm việc"
                  required
                />
              </label>

              <label className="field form-note--wide">
                <span>Mô tả ngắn ở Chân trang</span>
                <textarea
                  rows={3}
                  value={formData.footerDesc}
                  onChange={(e) => updateDraft((cur) => ({ ...cur, footerDesc: e.target.value }))}
                  placeholder="Nhập mô tả giới thiệu hiển thị ở chân trang"
                />
              </label>
            </div>
          </section>

          <section className="branches-editor-section">
            <div className="branches-editor-header">
              <div>
                <span className="eyebrow">Thông tin chi nhánh</span>
                <p className="form-hint">Nhập thông tin địa chỉ, SĐT và giờ làm việc cụ thể của từng địa điểm.</p>
              </div>
              <button type="button" className="button button--secondary" onClick={handleAddBranch}>
                + Thêm chi nhánh
              </button>
            </div>

            {formData.branches.length === 0 ? (
              <p className="form-hint">Chưa có chi nhánh nào được cấu hình. Bấm "+ Thêm chi nhánh" để tạo mới.</p>
            ) : (
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
                          placeholder="Nhập tên chi nhánh"
                          required
                        />
                      </label>

                      <label className="field">
                        <span>SĐT liên hệ trực tiếp</span>
                        <input
                          type="text"
                          value={branch.phone}
                          onChange={(e) => handleBranchChange(branch.id, 'phone', e.target.value)}
                          placeholder="Nhập số điện thoại liên hệ"
                          required
                        />
                      </label>

                      <label className="field form-note--wide">
                        <span>Giờ làm việc riêng của chi nhánh</span>
                        <input
                          type="text"
                          value={branch.workingHours}
                          onChange={(e) => handleBranchChange(branch.id, 'workingHours', e.target.value)}
                          placeholder="Nhập khung giờ & lịch hoạt động"
                          required
                        />
                      </label>

                      <label className="field form-note--wide">
                        <span>Địa chỉ chi nhánh</span>
                        <input
                          type="text"
                          value={branch.address}
                          onChange={(e) => handleBranchChange(branch.id, 'address', e.target.value)}
                          placeholder="Nhập địa chỉ chi nhánh"
                          required
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="panel-actions">
            <button type="submit" className="button button--primary button--large" disabled={saving}>
              {saving ? 'Đang lưu cấu hình...' : 'Lưu thay đổi cấu hình'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}