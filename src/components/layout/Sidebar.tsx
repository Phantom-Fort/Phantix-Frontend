import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  LayoutDashboard,
  Shield,
  Search,
  Radar,
  Swords,
  FileText,
  ClipboardCheck,
  Bell,
  Users,
  LogOut,
  ChevronLeft,
  ListChecks,
  AlertTriangle,
  ShieldAlert,
  User,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const navLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/onboarding', icon: Shield, label: 'Setup Wizard' },
  { to: '/assets', icon: Radar, label: 'Assets' },
  { to: '/discovery', icon: Search, label: 'Discovery' },
  { to: '/scans', icon: AlertTriangle, label: 'Scans' },
  { to: '/vapt', icon: Swords, label: 'VAPT Campaigns' },
  { to: '/risks', icon: ShieldAlert, label: 'Risks' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/tracker', icon: ListChecks, label: 'Tracker' },
  { to: '/compliance', icon: ClipboardCheck, label: 'Compliance' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/audit', icon: Users, label: 'Audit Log' },
]

export function Sidebar() {
  const { logout, orgUser } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // Seen critical alerts for "not viewed or attended"
  const [seenIds, setSeenIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('seenCriticalAlertIds')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const persistSeen = (newSet: Set<number>) => {
    localStorage.setItem('seenCriticalAlertIds', JSON.stringify(Array.from(newSet)))
    setSeenIds(newSet)
  }

  const markCategoryAttended = (category: string) => {
    const toMark = criticalAlerts.filter((a: any) => matchesCategory(a, category)).map((a: any) => a.id)
    if (toMark.length > 0) {
      const updated = new Set(seenIds)
      toMark.forEach(id => updated.add(id))
      persistSeen(updated)
    }
  }

  // Auto mark attended when visiting the relevant page
  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/scans')) markCategoryAttended('scans')
    else if (path.startsWith('/vapt')) markCategoryAttended('vapt')
    else if (path.startsWith('/risks')) markCategoryAttended('risks')
    else if (path.startsWith('/reports') || path.startsWith('/tracker')) markCategoryAttended('reports')
    else if (path === '/alerts') markCategoryAttended('alerts')
    else if (path === '/dashboard') markCategoryAttended('dashboard')
    else if (path === '/audit') markCategoryAttended('audit')
  }, [location.pathname])

  const { data: alertEvents } = useQuery({
    queryKey: ['alerts', 'events', 'sidebar'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/events?limit=100')
      return (data as { items?: any[]; total?: number }) || { items: [], total: 0 }
    },
    refetchInterval: 10000,
    enabled: !!useAuthStore.getState().orgToken,
  })

  const allPending = (alertEvents?.items || []).filter((a: any) => a.status !== 'sent' && a.status !== 'skipped')
  const criticalAlerts = allPending.filter((a: any) => a.severity === 'critical')
  const unreadCritical = criticalAlerts.filter((a: any) => !seenIds.has(a.id))

  const matchesCategory = (alert: any, cat: string) => {
    const et = alert.event_type || ''
    if (cat === 'scans') return et.includes('scan')
    if (cat === 'vapt') return et.includes('vapt') || et.includes('campaign')
    if (cat === 'risks') return et.includes('risk') || et.includes('treatment')
    if (cat === 'reports') return et.includes('report')
    if (cat === 'alerts') return true
    if (cat === 'dashboard') return true
    if (cat === 'audit') return et.includes('audit')
    return false
  }

  const getCriticalCountFor = (to: string): number => {
    if (to === '/dashboard') return unreadCritical.length
    if (to === '/scans') return unreadCritical.filter(a => matchesCategory(a, 'scans')).length
    if (to === '/vapt') return unreadCritical.filter(a => matchesCategory(a, 'vapt')).length
    if (to === '/risks') return unreadCritical.filter(a => matchesCategory(a, 'risks')).length
    if (to === '/reports' || to === '/tracker') return unreadCritical.filter(a => matchesCategory(a, 'reports')).length
    if (to === '/alerts') return unreadCritical.length
    if (to === '/audit') return unreadCritical.filter(a => matchesCategory(a, 'audit')).length
    return 0
  }

  // Blink for Scans when critical scan alert needs attention (new unread)
  const prevScanCriticalRef = useRef<number[]>([])
  const [isScanBlinking, setIsScanBlinking] = useState(false)

  useEffect(() => {
    const currentScanCritIds = unreadCritical.filter(a => matchesCategory(a, 'scans')).map(a => a.id)
    const prev = prevScanCriticalRef.current
    const hasNew = currentScanCritIds.some(id => !prev.includes(id))
    if (hasNew && currentScanCritIds.length > 0) {
      setIsScanBlinking(true)
      const t = setTimeout(() => setIsScanBlinking(false), 12000)
      prevScanCriticalRef.current = currentScanCritIds
      return () => clearTimeout(t)
    }
    prevScanCriticalRef.current = currentScanCritIds
  }, [unreadCritical])

  const getBadgeFor = (to: string): number => {
    return getCriticalCountFor(to)
  }

  return (
    <aside className={cn(
      'flex flex-col border-r bg-card dark:bg-[#0F1F45] dark:border-white/10 transition-all duration-200',
      collapsed ? 'w-16' : 'w-60',
    )}>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center w-full')}>
          <img src="/logo.png" alt="Phantix" className="h-7 w-7 object-contain" />
          {!collapsed && (
            <div className="leading-tight">
              <span className="font-semibold text-sm tracking-tight">Phantix</span>
              <div className="text-[8px] text-[#38BDF8] tracking-[1.2px] -mt-0.5">PROTECT. PREVENT. PERFORM.</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navLinks.map((link) => {
          const badge = getBadgeFor(link.to)
          const isScans = link.to === '/scans'
          const shouldBlink = isScans && badge > 0 && isScanBlinking
          return (
            <NavLink
              key={link.to}
              to={link.to}
              title={badge > 0 ? `${badge} critical alert(s) need attention` : undefined}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-brand-100/70 text-brand-700 dark:bg-[#162850] dark:text-[#38BDF8] border-l-2 border-[#38BDF8] font-semibold'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/5',
                collapsed && 'justify-center px-2',
                shouldBlink && 'scan-alert-blink'
              )}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{link.label}</span>
                  {badge > 0 && (
                    <span
                      className="ml-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-red-600 text-white font-mono"
                      onClick={(e) => {
                        // Clicking badge marks as attended for this category (rich UX)
                        e.preventDefault()
                        e.stopPropagation()
                        const cat = isScans ? 'scans' : link.to === '/vapt' ? 'vapt' : (link.to === '/reports' || link.to === '/tracker') ? 'reports' : link.to.replace('/', '')
                        markCategoryAttended(cat)
                        // navigate anyway
                        window.location.href = link.to
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && badge > 0 && (
                <span className={cn("ml-0.5 text-[9px] leading-none px-1 py-px rounded-full bg-red-600 text-white font-mono", shouldBlink && 'scan-alert-blink')}>{badge}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t p-2">
        {orgUser && !collapsed && (
          <div className="px-3 py-1.5 mb-1 text-[11px] text-muted-foreground flex items-center gap-1.5 truncate border-b pb-2">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{orgUser.full_name || orgUser.email || 'Team User'}</span>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  )
}
