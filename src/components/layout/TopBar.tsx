import { ThemeToggle } from './ThemeToggle'
import { useAuthStore } from '@/store/auth'

export function TopBar() {
  const { orgName } = useAuthStore()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card/95 backdrop-blur px-6 sticky top-0 z-30 dark:border-white/10 dark:bg-[#0F1F45]">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Phantix" className="h-7 w-7 object-contain" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold tracking-tight">Phantix</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium text-foreground/90">{orgName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
