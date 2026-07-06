import { AppSettings } from '@/types'

const SETTINGS_EXPORT_VERSION = 1

export interface ExportedSettings {
  version: number
  exportedAt: string
  settings: AppSettings
}

export function exportSettings(settings: AppSettings): string {
  const data: ExportedSettings = {
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  }
  return JSON.stringify(data, null, 2)
}

export function importSettings(json: string): AppSettings | null {
  try {
    const data = JSON.parse(json) as ExportedSettings
    if (data.version !== SETTINGS_EXPORT_VERSION) return null
    if (!data.settings?.apiBaseUrl || !data.settings?.defaultModel) return null
    return data.settings
  } catch {
    return null
  }
}
