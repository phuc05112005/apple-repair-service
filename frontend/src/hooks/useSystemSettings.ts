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
  logoUrl: '/logo.png',
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

const API_URL = '/api/v1/settings'

function getAuthToken(): string | null {
  const knownKeys = ['token', 'accessToken', 'access_token', 'authToken', 'jwt', 'taocare_token']

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of knownKeys) {
      const val = storage.getItem(key)
      if (val && val.startsWith('eyJ')) return val
    }
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key) continue
      const raw = storage.getItem(key) || ''
      if (raw.startsWith('eyJ')) return raw
      if (raw.includes('eyJ')) {
        const match = raw.match(/(eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)/)
        if (match) return match[1]
      }
    }
  }
  return null
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)

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

  const updateSettings = async (newSettings: SystemSettings) => {
    const token = getAuthToken()

    const res = await fetch(API_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(newSettings),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error('Phiên đăng nhập đã hết hạn hoặc thiếu quyền Admin (401). Vui lòng đăng xuất và đăng nhập lại!')
    }

    if (!res.ok) {
      throw new Error(`Lưu thất bại (Mã lỗi: ${res.status})`)
    }

    const savedData = await res.json()
    setSettings(savedData || newSettings)
    return savedData
  }

  return { settings, updateSettings, loading }
}