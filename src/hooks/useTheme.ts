import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
const preferenceFrom = (value: string | null | undefined): ThemePreference => value === 'light' || value === 'dark' ? value : 'system'

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => preferenceFrom(document.documentElement.dataset.themePreference))
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.themePreference = preference
      document.documentElement.dataset.theme = preference === 'system' ? media.matches ? 'dark' : 'light' : preference
    }
    apply()
    media.addEventListener('change', apply)
    const synchronize = (event: StorageEvent) => {
      if (event.key === 'panoptes.theme' || event.key === null) setPreference(preferenceFrom(event.newValue))
    }
    window.addEventListener('storage', synchronize)
    return () => { media.removeEventListener('change', apply); window.removeEventListener('storage', synchronize) }
  }, [preference])
  const choose = (next: ThemePreference) => {
    setPreference(next)
    try {
      if (next === 'system') localStorage.removeItem('panoptes.theme')
      else localStorage.setItem('panoptes.theme', next)
    } catch { /* The selection still works for this visit when storage is unavailable. */ }
  }
  return { preference, choose }
}
