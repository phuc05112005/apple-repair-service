import { useState } from 'react'

export interface BranchSetting {
  id: string
  name: string
  address: string
  phone: string
  workingHours: string
}

export interface SystemSettings {
  hotline: string
  zaloPhone: string
  email: string
  workingHours: string
  footerDesc: string
  logoUrl: string
  branches: BranchSetting[]
}

const DEFAULT_SETTINGS: SystemSettings = {
  hotline: '1900 1234',
  zaloPhone: '0901234567',
  email: 'support@taocare.vn',
  workingHours: '08:00 - 21:00 (Tất cả các ngày)',
  footerDesc: 'Hệ thống kỹ thuật & bảo hành thiết bị Apple chuyên nghiệp, minh bạch từ khâu tiếp nhận, chẩn đoán đến bàn giao.',
  logoUrl: '/assets/logo.png',
  branches: [
    {
      id: 'branch-1',
      name: 'Chi nhánh Quận 1',
      address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM',
      phone: '028 7300 1234',
      workingHours: '08:00 - 21:00 (Tất cả các ngày)',
    },
    {
      id: 'branch-2',
      name: 'Chi nhánh Quận 10',
      address: '456 Đường 3/2, Phường 12, Quận 10, TP.HCM',
      phone: '028 7300 5678',
      workingHours: '08:00 - 20:30 (Thứ 2 - Thứ 7)',
    },
  ],
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('taocare_system_settings')
    if (!saved) return DEFAULT_SETTINGS
    try {
      const parsed = JSON.parse(saved)
      // Tự động chuyển đổi nếu dữ liệu cũ chưa có mảng branches
      if (!parsed.branches || !Array.isArray(parsed.branches)) {
        parsed.branches = [
          {
            id: 'branch-1',
            name: 'Chi nhánh Quận 1',
            address: parsed.branch1 || DEFAULT_SETTINGS.branches[0].address,
            phone: '028 7300 1234',
          },
          {
            id: 'branch-2',
            name: 'Chi nhánh Quận 10',
            address: parsed.branch2 || DEFAULT_SETTINGS.branches[1].address,
            phone: '028 7300 5678',
          },
        ]
      }
      return { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const updateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings)
    localStorage.setItem('taocare_system_settings', JSON.stringify(newSettings))
  }

  return { settings, updateSettings }
}