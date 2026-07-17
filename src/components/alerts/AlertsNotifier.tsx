import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToastStore } from '@/store/toast'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth'

export function AlertsNotifier() {
  const { addToast } = useToastStore()
  const { orgToken } = useAuthStore()
  const seenIds = useRef<Set<number>>(new Set())

  const { data } = useQuery({
    queryKey: ['alerts', 'events', 'notifier'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/events?limit=30')
      return data as { items: any[] }
    },
    refetchInterval: 8000,
    enabled: !!orgToken,
  })

  useEffect(() => {
    if (!data?.items) return
    const newOnes = data.items.filter((a: any) => {
      if (seenIds.current.has(a.id)) return false
      seenIds.current.add(a.id)
      return ['pending', 'processing'].includes(a.status) && ['high', 'critical'].includes(a.severity)
    })
    newOnes.forEach((alert: any) => {
      addToast({
        type: alert.severity === 'critical' ? 'error' : 'warning',
        title: alert.title,
        message: alert.body || alert.event_type,
        duration: alert.severity === 'critical' ? 12000 : 7000,
      })
    })
  }, [data, addToast])

  return null
}
