import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useDualControlStore } from '@/store/dualControl'
import { useAuthStore } from '@/store/auth'
import { useToastStore } from '@/store/toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'
const DC_CONFIGURED_KEY = 'dual_control_configured'

export const api = axios.create({
  baseURL: `${BASE_URL}${API_PREFIX}`,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

export const publicApi = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
})

/** Persist whether dual-control slots are assigned (for request interceptor). */
export function setDualControlConfigured(configured: boolean) {
  if (configured) {
    localStorage.setItem(DC_CONFIGURED_KEY, 'true')
  } else {
    localStorage.removeItem(DC_CONFIGURED_KEY)
  }
}

export function isDualControlConfigured(): boolean {
  return localStorage.getItem(DC_CONFIGURED_KEY) === 'true'
}

/** Clear stale dual-control session (must not be sent during bootstrap). */
export function clearDcSession() {
  sessionStorage.removeItem('dc_session')
  useAuthStore.setState({ dcSession: null, orgUser: null })
}

function stripDcHeader(config: InternalAxiosRequestConfig) {
  const h = config.headers as any
  if (!h) return
  if (typeof h.delete === 'function') {
    h.delete('X-Dual-Control-Session')
    h.delete('x-dual-control-session')
  } else {
    delete h['X-Dual-Control-Session']
    delete h['x-dual-control-session']
  }
}

function isBootstrapPath(method: string, url: string): boolean {
  const m = method.toLowerCase()
  const u = url.split('?')[0]
  // POST /org-users (create) — not /org-users/auth/*
  if (m === 'post' && (u === '/org-users' || u.endsWith('/org-users'))) return true
  // PUT /org-users/dual-control
  if (m === 'put' && u.includes('/org-users/dual-control')) return true
  return false
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('org_jwt')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const method = (config.method || 'get').toLowerCase()
  const url = (config.url || '').toString()
  const explicitSkip = !!(config as any)._skipDc
  const dualConfigured = isDualControlConfigured()

  // Per DUAL_CONTROL_SETUP_FE.md Phase 1–2:
  // Bootstrap must use company JWT ONLY — never X-Dual-Control-Session.
  // Sending a stale session makes the backend treat the principal as a non-owner
  // org-user (not can_operate, not is_org_owner_token) → 403 with dual_control_configured:false.
  const skipDc =
    explicitSkip ||
    !dualConfigured ||
    isBootstrapPath(method, url) ||
    ['get', 'head'].includes(method)

  const dcSession = sessionStorage.getItem('dc_session')

  if (!skipDc && dcSession) {
    config.headers['X-Dual-Control-Session'] = dcSession
  } else {
    stripDcHeader(config)
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('org_jwt')
      localStorage.removeItem('org_jwt')
      sessionStorage.removeItem('dc_session')
      if (hadToken) {
        useAuthStore.getState().signalAuthExpired()
      }
    }

    const detail = (error.response?.data as any)?.detail
    const msg = typeof detail === 'string' ? detail : detail?.message || ''
    const needsDcHeader =
      error.response?.status === 403 &&
      (detail?.required_header === 'X-Dual-Control-Session' ||
        /X-Dual-Control-Session|Authenticator session|dual-control session|assigned initiator|assigned authorizer/i.test(
          msg,
        ))

    // Dual-control not configured at all → redirect to setup wizard
    // (case 1 in org_operate_middleware: configured=false, no bootstrap path)
    if (
      error.response?.status === 403 &&
      detail &&
      typeof detail === 'object' &&
      (detail as Record<string, unknown>).dual_control_configured === false
    ) {
      setDualControlConfigured(false)
      clearDcSession()
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Setup Required',
        message:
          'Dual-control has not been configured. Complete the organization setup wizard first.',
        duration: 8000,
      })
      if (!window.location.pathname.startsWith('/onboarding')) {
        window.location.href = '/onboarding'
      }
      return Promise.reject(error)
    }

    if (needsDcHeader) {
      const hadDcSession = !!sessionStorage.getItem('dc_session')
      sessionStorage.removeItem('dc_session')
      useAuthStore.setState({ dcSession: null })
      const dcStore = useDualControlStore.getState()
      if (hadDcSession) {
        dcStore.signalSessionExpired()
      }
      const config = error.config
      if (config && !(config as any)._dcPrompted) {
        ;(config as any)._dcPrompted = true
        let role: 'initiator' | 'authorizer' | 'any' = 'any'
        if (/authorizer/i.test(msg) && !/initiator/i.test(msg)) role = 'authorizer'
        else if (/initiator/i.test(msg) && !/authorizer/i.test(msg)) role = 'initiator'
        // Approve/reject paths always need authorizer
        const url = String(config.url || '')
        if (url.includes('/approve') || url.includes('/reject')) role = 'authorizer'
        if (url.includes('/submit') || (url.includes('/treatments') && config.method === 'post' && !url.includes('/treatments/'))) {
          role = 'initiator'
        }
        // Planning → initiator, execution → authorizer
        if (url.endsWith('/vapt/plan') && config.method?.toLowerCase() === 'post') role = 'initiator'
        if (url.includes('/plan/execute')) role = 'authorizer'
        // Return a pending Promise that resolves after DC unlock + retry
        // so the original caller (mutation/query) sees success, not error.
        // Resolve with full AxiosResponse so `const { data } = await api.xx()` works.
        return new Promise((resolve, reject) => {
          dcStore.requireDcSession({
            retry: () =>
              api.request(config).then((r) => {
                resolve(r)
                return r
              }),
            label: `${(config.method || 'GET').toUpperCase()} ${config.url}`,
            role,
            _resolve: resolve,
            _reject: reject,
          })
        })
      }
    }

    return Promise.reject(error)
  },
)

export function formLogin(endpoint: string, username: string, password: string) {
  return api.post(endpoint, `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export function saveOrgToken(token: string) {
  localStorage.setItem('org_jwt', token)
}

export function saveDcSession(session: string) {
  sessionStorage.setItem('dc_session', session)
}

export function clearAuth() {
  localStorage.removeItem('org_jwt')
  sessionStorage.removeItem('dc_session')
  localStorage.removeItem(DC_CONFIGURED_KEY)
}

export function getOrgToken(): string | null {
  return localStorage.getItem('org_jwt')
}

/** Format API error detail for UI. */
export function formatApiError(err: any, fallback = 'Request failed'): string {
  const d = err?.response?.data?.detail
  if (!d) return err?.message || fallback
  if (typeof d === 'string') return d
  if (d.message) return d.message
  if (Array.isArray(d)) {
    return d.map((x: any) => x.msg || x.message || JSON.stringify(x)).join('; ')
  }
  return fallback
}
