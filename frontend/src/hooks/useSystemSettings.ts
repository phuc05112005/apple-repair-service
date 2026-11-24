import { useState, useEffect, useCallback } from 'react'

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

const EMPTY_SETTINGS: SystemSettings = {
  hotline: '',
  zaloPhone: '',
  email: '',
  workingHours: '',
  footerDesc: '',
  logoUrl: '',
  branches: [],
}

const API_URL = '/api/v1/settings'
const BRANCHES_API_URL = '/api/v1/branches'

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

function normalizeBranches(rawBranches: unknown): BranchSetting[] {
  if (!Array.isArray(rawBranches)) return []
  return rawBranches.map((item, idx) => {
    const b = (item ?? {}) as Record<string, unknown>
    return {
      id: String(b.id ?? `branch-${idx + 1}`),
      name: String(b.name ?? ''),
      address: String(b.address ?? ''),
      phone: String(b.phone ?? ''),
      workingHours: String(b.workingHours ?? b.working_hours ?? ''),
    }
  })
}

function normalizeSettings(
  raw: Record<string, unknown> | null | undefined,
  branches: BranchSetting[]
): SystemSettings {
  const data = raw ?? {}
  return {
    hotline: String(data.hotline ?? ''),
    zaloPhone: String(data.zaloPhone ?? data.zalo_phone ?? ''),
    email: String(data.email ?? ''),
    workingHours: String(data.workingHours ?? data.working_hours ?? ''),
    footerDesc: String(data.footerDesc ?? data.footer_desc ?? ''),
    logoUrl: String(data.logoUrl ?? data.logo_url ?? ''),
    branches,
  }
}

async function fetchSystemBranches(fallbackPhone: string, fallbackHours: string): Promise<BranchSetting[]> {
  try {
    const res = await fetch(BRANCHES_API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const raw = await res.json()
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : []

    return list
      .filter((item: Record<string, unknown>) => item.active !== false)
      .map((item: Record<string, unknown>, idx: number) => ({
        id: String(item.id ?? `branch-${idx + 1}`),
        name: String(item.name ?? ''),
        address: String(item.address ?? ''),
        phone: String(item.phone ?? fallbackPhone ?? ''),
        workingHours: String(item.workingHours ?? item.working_hours ?? fallbackHours ?? ''),
      }))
  } catch {
    return []
  }
}

async function fetchSettingsData(): Promise<SystemSettings> {
  try {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Không thể tải cấu hình hệ thống')
    const data = (await res.json()) as Record<string, unknown>

    let resolvedBranches = normalizeBranches(data?.branches)
    if (resolvedBranches.length === 0) {
      resolvedBranches = await fetchSystemBranches(
        String(data?.hotline ?? ''),
        String(data?.workingHours ?? data?.working_hours ?? '')
      )
    }

    return normalizeSettings(data, resolvedBranches)
  } catch (error) {
    console.error('Lỗi tải cài đặt hệ thống từ server:', error)
    const fallbackBranches = await fetchSystemBranches('', '')
    return { ...EMPTY_SETTINGS, branches: fallbackBranches }
  }
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    fetchSettingsData()
      .then((resolved) => {
        if (isMounted) setSettings(resolved)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const reloadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const resolved = await fetchSettingsData()
      setSettings(resolved)
    } finally {
      setLoading(false)
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

    const rawText = await res.text()
    const savedData = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null
    const savedBranches =
      savedData && Array.isArray(savedData.branches)
        ? normalizeBranches(savedData.branches)
        : newSettings.branches

    const normalized = savedData ? normalizeSettings(savedData, savedBranches) : newSettings
    setSettings(normalized)
    return normalized
  }

  return { settings, updateSettings, reloadSettings, loading }
}