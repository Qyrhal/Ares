export interface Theme {
  id: string
  label: string
  /** Main accent colour — hex */
  primary: string
  /** Foreground on the primary colour */
  primaryForeground: string
}

export const THEMES: Theme[] = [
  {
    id: 'red',
    label: 'Red',
    primary: '#dc2626',
    primaryForeground: '#ffffff',
  },
  {
    id: 'blue',
    label: 'Blue',
    primary: '#2563eb',
    primaryForeground: '#ffffff',
  },
  {
    id: 'green',
    label: 'Green',
    primary: '#16a34a',
    primaryForeground: '#ffffff',
  },
  {
    id: 'orange',
    label: 'Orange',
    primary: '#ea580c',
    primaryForeground: '#ffffff',
  },
  {
    id: 'zinc',
    label: 'Zinc',
    primary: '#71717a',
    primaryForeground: '#ffffff',
  },
]

export const DEFAULT_THEME_ID = 'red'

export type ColorMode = 'dark' | 'light'

export function applyTheme(themeId: string): void {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-primary-foreground', theme.primaryForeground)
  root.style.setProperty('--color-ring', theme.primary)
}

export function applyColorMode(mode: ColorMode): void {
  document.documentElement.classList.toggle('light', mode === 'light')
}
