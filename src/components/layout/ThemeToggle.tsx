import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/theme'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative h-8 w-8 rounded-full transition-all hover:bg-accent"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Sun className={`h-4 w-4 transition-all ${theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0'}`} />
      <Moon className={`absolute h-4 w-4 transition-all ${theme === 'light' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'}`} />
    </Button>
  )
}
