import React, { ComponentType } from 'react'

export const safeLazy = <P extends object = Record<string, never>>(
  importFn: () => Promise<Record<string, unknown>>,
  exportName?: string
) =>
  React.lazy(async () => {
    const module = await importFn()

    // 1. Nếu khai báo tên export cụ thể (VD: 'SlotsPage', 'SchedulesPage')
    if (exportName) {
      if (module[exportName]) {
        return { default: module[exportName] as ComponentType<P> }
      }
      if (module.default) {
        return { default: module.default as ComponentType<P> }
      }
      console.error(`[safeLazy Error] Không tìm thấy export "${exportName}" trong module:`, module)
      throw new Error(`File không chứa export "${exportName}". Kiếm tra lại tên export hoặc đường dẫn file.`)
    }

    // 2. Nếu không chỉ định exportName
    if (module.default) {
      return { default: module.default as ComponentType<P> }
    }

    const firstKey = Object.keys(module).find(
      (key) => typeof module[key] === 'function' || (typeof module[key] === 'object' && module[key] !== null)
    )
    if (firstKey && module[firstKey]) {
      return { default: module[firstKey] as ComponentType<P> }
    }

    throw new Error('Không tìm thấy Component hợp lệ trong file import.')
  })