import { create } from 'zustand'

interface PendingRetry {
  retry: () => Promise<unknown>
  label?: string
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
  requireDcSession: (pending: PendingRetry) => set({ isOpen: true, pending }),
  dismiss: () => set({ isOpen: false }),
  clearPending: () => set({ pending: null, isOpen: false }),
  signalSessionExpired: () => set({ sessionExpired: true }),
  clearSessionExpired: () => set({ sessionExpired: false }),
}))
