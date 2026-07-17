import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
}

interface SubPageNavProps {
  items: NavItem[]
}

export function SubPageNav({ items }: SubPageNavProps) {
  const location = useLocation()
  const current = location.pathname + location.search

  const isActive = (to: string) => {
    if (to === '/scans/results') return current.startsWith('/scans/results')
    if (to === '/scans') return location.pathname === '/scans'
    if (to === '/vapt') return location.pathname === '/vapt'
    if (to.startsWith('/vapt/')) return location.pathname.startsWith('/vapt/')
    if (to === '/reports') return location.pathname === '/reports'
    if (to === '/tracker') return location.pathname === '/tracker'
    if (to === '/assets') return location.pathname === '/assets'
    if (to === '/discovery') return location.pathname === '/discovery'
    return current.startsWith(to)
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      {items.map((item) => {
        const active = isActive(item.to)
        if (active) {
          return (
            <span
              key={item.to}
              className="text-xs px-3 py-1 rounded-full bg-brand-700 text-white font-medium"
            >
              {item.label}
            </span>
          )
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
