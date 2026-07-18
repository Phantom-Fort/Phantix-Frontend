import { useToastStore, type ToastType } from '@/store/toast'
import { formatApiError } from '@/lib/api'

/** Fire a toast from anywhere (components, interceptors, helpers). */
export function toast(type: ToastType, title: string, message?: string, duration?: number) {
  useToastStore.getState().addToast({ type, title, message, duration })
}

export function toastError(title: string, message?: string) {
  toast('error', title, message, 7000)
}

export function toastSuccess(title: string, message?: string) {
  toast('success', title, message)
}

export function toastWarning(title: string, message?: string) {
  toast('warning', title, message)
}

export function toastInfo(title: string, message?: string) {
  toast('info', title, message)
}

/** Prefer API detail when available. */
export function toastApiError(err: unknown, fallback = 'Request failed') {
  toastError(formatApiError(err, fallback))
}
