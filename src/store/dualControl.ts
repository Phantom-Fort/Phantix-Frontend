import { create } from 'zustand'

export type DcRoleRequired = 'initiator' | 'authorizer' | 'any'

export interface PendingRetry {
  retry: () => Promise<unknown>
  label?: string
  /** Who must unlock for this action */
  role?: DcRoleRequired
  /** Resolve the original intercepted request's promise when unlock succeeds */
  _resolve?: (value: unknown) => void
  /** Reject the original intercepted request's promise when unlock fails/dismissed */
  _reject?: (reason?: unknown) => void
}

interface DualControlState {
  isOpen: boolean
  pending: PendingRetry | null
  sessionExpired: boolean
  requireDcSession: (pending: PendingRetry) => void
  dismiss: () => void
  clearPending: () => void
  signalSessionExpired: () => void
  clearSessionExpired: () => void
}

export const useDualControlStore = create<DualControlState>((set) => ({
  isOpen: false,
  pending: null,
  sessionExpired: false,
  requireDcSession: (pending: PendingRetry) =>
    set({ isOpen: true, pending: { role: pending.role || 'any', ...pending } }),
  dismiss: () => {
    set((s) => {
      s.pending?._reject?.(new Error('Dual-control unlock dismissed'))
      return { isOpen: false }
    })
  },
  clearPending: () => set({ pending: null, isOpen: false }),
  signalSessionExpired: () => set({ sessionExpired: true }),
  clearSessionExpired: () => set({ sessionExpired: false }),
}))
