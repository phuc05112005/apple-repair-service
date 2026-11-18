import { useState, useEffect } from 'react'

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

// Đổi đường dẫn này khớp với cấu hình base URL gọi API của dự án bạn (ví dụ: '/api/settings')
const API_URL = '/api/settings'

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)

  // 1. Mọi trình duyệt khi mở web đều gọi GET lên server EC2 để lấy dữ liệu mới nhất
  useEffect(() => {
    let isMounted = true

    const fetchSettings = async () => {
      try {
        const res = await fetch(API_URL, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Không thể tải cấu hình hệ thống')
        const data = await res.json()

        if (isMounted && data) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            branches: Array.isArray(data.branches) && data.branches.length > 0
              ? data.branches
              : DEFAULT_SETTINGS.branches,
          })
        }
      } catch (error) {
        console.error('Lỗi tải cài đặt hệ thống từ server:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchSettings()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Khi Admin bấm Lưu, gửi PUT lên server EC2 để lưu thẳng vào Database
  const updateSettings = async (newSettings: SystemSettings) => {
    // Đổi tên key 'token' bên dưới cho khớp với tên key lưu JWT trong localStorage của bạn
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken')

    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(newSettings),
    })

    if (!res.ok) {
      throw new Error(`Lưu thất bại (Mã lỗi: ${res.status})`)
    }

    const savedData = await res.json()
    setSettings(savedData || newSettings)
    return savedData
  }

  return { settings, updateSettings, loading }
}