import { create } from 'zustand'
import { getOrgToken } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

interface AuthState {
  orgToken: string | null
  dcSession: string | null
  isAuthenticated: boolean
  authExpired: boolean
  orgName: string
  orgUser: { id?: number; full_name?: string; email?: string; role?: string } | null
  checkAuth: () => void
  setOrgAuth: (token: string) => void
  setDcSession: (session: string, user?: any) => void
  setOrgUser: (user: any) => void
  signalAuthExpired: () => void
  clearAuthExpired: () => void
  logout: () => void
}

function getOrgName(token: string | null): string {
  if (!token) return 'Organization'
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.org_name || payload.name || payload.organization_name || payload.org?.name || 'Organization'
  } catch {
    return 'Organization'
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const token = getOrgToken()
  const initialOrgName = getOrgName(token)

  return {
    orgToken: token,
    dcSession: sessionStorage.getItem('dc_session'),
    isAuthenticated: !!token,
    authExpired: false,
    orgName: initialOrgName,
    orgUser: null,

    checkAuth: () => {
      const org = getOrgToken()
      set({
        orgToken: org,
        isAuthenticated: !!org,
        dcSession: sessionStorage.getItem('dc_session'),
        orgName: getOrgName(org),
      })
    },

    setOrgAuth: (token: string) => {
      localStorage.setItem('org_jwt', token)
      queryClient.clear()
      set({ orgToken: token, isAuthenticated: true, authExpired: false, orgName: getOrgName(token) })
    },

    setDcSession: (session: string, user?: any) => {
      sessionStorage.setItem('dc_session', session)
      set({ dcSession: session, orgUser: user || null })
    },

    setOrgUser: (user: any) => {
      set({ orgUser: user || null })
    },

    signalAuthExpired: () => {
      queryClient.clear()
      set({ authExpired: true })
    },

    clearAuthExpired: () => set({ authExpired: false }),

    logout: () => {
      localStorage.removeItem('org_jwt')
      sessionStorage.removeItem('dc_session')
      queryClient.clear()
      set({ orgToken: null, dcSession: null, isAuthenticated: false, authExpired: false, orgName: 'Organization', orgUser: null })
    },
  }
})
