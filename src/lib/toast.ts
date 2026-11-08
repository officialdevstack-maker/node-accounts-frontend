import { createRef } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  /** Optional bold heading above the message. */
  title?: string
  /** Milliseconds before auto-dismiss. 0 keeps it until closed. */
  duration?: number
  /** Reuse an id to update an existing toast instead of stacking a new one. */
  id?: string
}

/** The imperative API that <Toaster /> exposes through its ref. */
export type ToasterHandle = {
  show: (message: string, variant?: ToastVariant, options?: ToastOptions) => string
  dismiss: (id: string) => void
  clear: () => void
}

/** Attached to the single <Toaster /> mounted in App.tsx. */
export const toastRef = createRef<ToasterHandle>()

export const toast = {
  show: (message: string, variant: ToastVariant = 'info', options?: ToastOptions) =>
    toastRef.current?.show(message, variant, options),
  success: (message: string, options?: ToastOptions) =>
    toastRef.current?.show(message, 'success', options),
  error: (message: string, options?: ToastOptions) =>
    toastRef.current?.show(message, 'error', options),
  warning: (message: string, options?: ToastOptions) =>
    toastRef.current?.show(message, 'warning', options),
  info: (message: string, options?: ToastOptions) =>
    toastRef.current?.show(message, 'info', options),
  dismiss: (id: string) => toastRef.current?.dismiss(id),
  clear: () => toastRef.current?.clear(),
}
