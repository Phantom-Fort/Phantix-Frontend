import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useDualControlStore } from '@/store/dualControl'
import { useAuthStore } from '@/store/auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_PREFIX = '/api/v1'

export const api = axios.create({
  baseURL: `${BASE_URL}${API_PREFIX}`,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

export const publicApi = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('org_jwt')
  const dcSession = sessionStorage.getItem('dc_session')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (dcSession && config.method && !['get', 'head'].includes(config.method)) {
    config.headers['X-Dual-Control-Session'] = dcSession
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
    if (error.response?.status === 403 && detail?.required_header === 'X-Dual-Control-Session') {
      const hadDcSession = !!sessionStorage.getItem('dc_session')
      sessionStorage.removeItem('dc_session')
      const dcStore = useDualControlStore.getState()
      if (hadDcSession) {
        dcStore.signalSessionExpired()
      }
      const config = error.config
      if (config) {
        dcStore.requireDcSession({
          retry: () => api.request(config).then((r) => r.data),
          label: `${config.method?.toUpperCase()} ${config.url}`,
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
}

export function getOrgToken(): string | null {
  return localStorage.getItem('org_jwt')
}
