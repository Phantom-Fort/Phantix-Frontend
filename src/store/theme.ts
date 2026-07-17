import { create } from 'zustand'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'  // dark is default (nicer per user)
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('theme', theme)
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getInitialTheme()
  applyTheme(initial)

  return {
    theme: initial,
    toggle: () =>
      set((state) => {
        const next = state.theme === 'light' ? 'dark' : 'light'
        applyTheme(next)
        return { theme: next }
      }),
    setTheme: (t: Theme) => {
      applyTheme(t)
      set({ theme: t })
    },
  }
})
