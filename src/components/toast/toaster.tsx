import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import type { ToasterHandle, ToastVariant } from '../../lib/toast'

type ToastData = {
  key: string
  id: string
  message: string
  title?: string
  variant: ToastVariant
  duration: number
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string }> = {
  success: { border: 'border-l-green-600', icon: 'text-green-600' },
  error: { border: 'border-l-red-600', icon: 'text-red-600' },
  warning: { border: 'border-l-amber-500', icon: 'text-amber-500' },
  info: { border: 'border-l-blue-600', icon: 'text-blue-600' },
}

const ICON_PATHS: Record<ToastVariant, ReactNode> = {
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16v.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 3 19.5h18z" />
      <path d="M12 10v4" />
      <path d="M12 17v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8v.01" />
    </>
  ),
}

const Icon = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <svg
    className={`h-5 w-5 flex-none ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

type ToastItemProps = {
  toast: ToastData
  onDismiss: (id: string) => void
}

const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)

  useEffect(() => {
    if (toast.duration <= 0 || paused) return

    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current)

    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, toast.duration, toast.id, onDismiss])

  const style = VARIANT_STYLES[toast.variant]

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-l-4 border-gray-200 bg-white p-4 shadow-lg motion-reduce:animate-none ${style.border}`}
    >
      <span className={`mt-0.5 ${style.icon}`}>
        <Icon>{ICON_PATHS[toast.variant]}</Icon>
      </span>

      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        <p className="break-words text-sm text-gray-600">{toast.message}</p>
      </div>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 rounded p-1 text-gray-400 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Icon className="h-4 w-4">
          <path d="m6 6 12 12M18 6 6 18" />
        </Icon>
      </button>
    </div>
  )
}

type ToasterProps = {
  ref?: Ref<ToasterHandle>
  max?: number
}

const Toaster = ({ ref, max = 4 }: ToasterProps) => {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      show(message, variant = 'info', options = {}) {
        counter.current += 1
        const id = options.id ?? `toast-${counter.current}`
        const item: ToastData = {
          key: `${id}:${counter.current}`,
          id,
          message,
          title: options.title,
          variant,
          duration: options.duration ?? DEFAULT_DURATION[variant],
        }

        setToasts((list) => {
          const exists = list.some((t) => t.id === id)
          const next = exists ? list.map((t) => (t.id === id ? item : t)) : [...list, item]
          return next.slice(-max)
        })

        return id
      },
      dismiss,
      clear() {
        setToasts([])
      },
    }),
    [dismiss, max],
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-end gap-2 px-4">
      {toasts.map((t) => (
        <ToastItem key={t.key} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}

export default Toaster
