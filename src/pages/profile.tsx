import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { requestVerificationCode } from '../lib/auth'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, toSquareJpeg } from '../lib/avatar'
import { toast } from '../lib/toast'

type UserProfile = {
  id?: number
  fullname?: string
  name?: string
  email?: string
  phone?: string | null
  isVerified?: boolean
  accountType?: string
  account_type?: string
  avatarUrl?: string | null
}

type Theme = 'light' | 'dark'

type Device = {
  id: number
  deviceName: string
  ipAddress: string | null
  lastUsedAt: string | null
  signedInAt: string
  expiresAt: string | null
  current: boolean
}

type Preferences = {
  newDeviceAlerts: boolean
  loginAlerts: boolean
}

type ActivityItem = {
  id: number
  event: string
  ipAddress: string | null
  deviceName: string | null
  createdAt: string
}

const EVENT_LABELS: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  logout_all: 'Signed out of all devices',
  password_changed: 'Password changed',
  password_reset: 'Password reset',
  email_verified: 'Email verified',
  device_revoked: 'Device signed out',
  profile_updated: 'Profile updated',
  avatar_updated: 'Profile photo changed',
  avatar_removed: 'Profile photo removed',
  data_exported: 'Account data downloaded',
}

const THEME_KEY = 'profile-theme'
const PREF_FIELDS = {
  newDeviceAlerts: 'new_device_alerts',
  loginAlerts: 'login_alerts',
} as const

const isPreferences = (value: unknown): value is Preferences =>
  typeof value === 'object' &&
  value !== null &&
  'newDeviceAlerts' in value &&
  typeof value.newDeviceAlerts === 'boolean' &&
  'loginAlerts' in value &&
  typeof value.loginAlerts === 'boolean'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const DEVICE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

const timeAgo = (iso: string) => {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  for (const [unit, size] of DEVICE_UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit)
  }

  return 'just now'
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { dateStyle: 'medium' })

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

const isPhone = (name: string) => /iOS|Android/i.test(name)

const DeviceIcon = ({ phone }: { phone: boolean }) => (
  <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {phone ? (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2.5" />
        <path d="M11 18h2" />
      </>
    ) : (
      <>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    )}
  </svg>
)

const views = [
  { id: 'overview', label: 'Home', icon: 'home' },
  { id: 'personal', label: 'Personal info', icon: 'person' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'privacy', label: 'Data & privacy', icon: 'privacy' },
  { id: 'apps', label: 'Connected apps', icon: 'apps' },
] as const

type ViewId = (typeof views)[number]['id']
type IconName =
  | (typeof views)[number]['icon']
  | 'moon'
  | 'check'
  | 'alert'
  | 'done'
  | 'todo'
  | 'chevron'

const iconPaths: Record<IconName, ReactNode> = {
  home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c.6-3.6 3.8-6 7.5-6s6.9 2.4 7.5 6" />
    </>
  ),
  security: <path d="M12 3 4.5 6v5.5c0 4.4 3 8 7.5 9.5 4.5-1.5 7.5-5.1 7.5-9.5V6z" />,
  privacy: (
    <>
      <rect x="3" y="7.5" width="18" height="9" rx="4.5" />
      <circle cx="16.5" cy="12" r="2" />
    </>
  ),
  apps: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16v.01" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </>
  ),
  todo: <circle cx="12" cy="12" r="9" />,
  chevron: <path d="m9 6 6 6-6 6" />,
}

const Icon = ({ name }: { name: IconName }) => (
  <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {iconPaths[name]}
  </svg>
)

const StatusChip = ({ verified }: { verified: boolean }) => (
  <span className={`profile-chip ${verified ? 'is-good' : 'is-warn'}`}>
    <Icon name={verified ? 'check' : 'alert'} />
    {verified ? 'Verified' : 'Not verified'}
  </span>
)

const readInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); fall through.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const readViewFromHash = (): ViewId => {
  if (typeof window === 'undefined') return 'overview'
  const id = window.location.hash.replace('#', '')
  return views.find((item) => item.id === id)?.id ?? 'overview'
}

const Profile = () => {
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({})
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ fullname: '', phone: '' })
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({})
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [deviceBusyId, setDeviceBusyId] = useState<number | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [deviceReloadKey, setDeviceReloadKey] = useState(0)
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [prefsSaving, setPrefsSaving] = useState<keyof Preferences | null>(null)
  const [prefsReloadKey, setPrefsReloadKey] = useState(0)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityReloadKey, setActivityReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  const [view, setView] = useState<ViewId>(readViewFromHash)

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })

        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login', { replace: true })
            return
          }
          throw new Error('Could not load your profile.')
        }

        const payload = await res.json()
        const nextUser = payload?.data ?? payload?.user ?? payload

        if (!mounted) return
        setUser(nextUser ?? null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadProfile()
    return () => {
      mounted = false
    }
  }, [navigate, attempt])

  // Each section is its own page, driven by the URL hash (#personal, #security, ...).
  useEffect(() => {
    const onHashChange = () => {
      setView(readViewFromHash())
      window.scrollTo(0, 0)
      // Move focus to the new page so keyboard and screen-reader users land on it.
      window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (view !== 'security') return

    let alive = true

    const loadDevices = async () => {
      setDevicesLoading(true)
      setDevicesError(null)
      try {
        const res = await fetch('/api/auth/devices', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })

        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login', { replace: true })
            return
          }
          throw new Error('Could not load your devices.')
        }

        const payload = await res.json()
        const list = Array.isArray(payload?.data) ? (payload.data as Device[]) : []
        if (!alive) return
        setDevices(list)
      } catch (err) {
        if (!alive) return
        setDevicesError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        if (alive) setDevicesLoading(false)
      }
    }

    void loadDevices()
    return () => {
      alive = false
    }
  }, [deviceReloadKey, navigate, view])

  useEffect(() => {
    if (view !== 'security') return
    let alive = true

    const loadPrefs = async () => {
      setPrefsError(null)
      try {
        const res = await fetch('/api/auth/preferences', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (res.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        if (!res.ok) throw new Error('Could not load your alert settings.')

        const payload = await res.json()
        if (!isPreferences(payload?.data)) throw new Error('Could not load your alert settings.')
        if (alive) setPrefs(payload.data)
      } catch (err) {
        if (alive) setPrefsError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    }

    void loadPrefs()
    return () => {
      alive = false
    }
  }, [prefsReloadKey, navigate, view])

  useEffect(() => {
    if (view !== 'privacy') return
    let alive = true

    const loadActivity = async () => {
      setActivityLoading(true)
      setActivityError(null)
      try {
        const res = await fetch('/api/auth/activity?per_page=10', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (res.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        if (!res.ok) throw new Error('Could not load your activity.')

        const payload = await res.json()
        if (!alive) return
        setActivity(Array.isArray(payload?.data) ? (payload.data as ActivityItem[]) : [])
      } catch (err) {
        if (alive) setActivityError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        if (alive) setActivityLoading(false)
      }
    }

    void loadActivity()
    return () => {
      alive = false
    }
  }, [activityReloadKey, navigate, view])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Ignore: the choice just won't persist.
    }
  }

  const retry = () => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }

  const reloadDevices = () => {
    setDevices(null)
    setDevicesError(null)
    setDeviceReloadKey((n) => n + 1)
  }

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    if (!prefs || prefsSaving) return
    const previous = prefs
    setPrefs({ ...prefs, [key]: value })
    setPrefsSaving(key)

    try {
      const res = await fetch('/api/auth/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ [PREF_FIELDS[key]]: value }),
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Could not save your setting.')
      }

      const payload = await res.json()
      if (!isPreferences(payload?.data)) throw new Error('Could not save your setting.')
      setPrefs(payload.data)
      toast.success(value ? 'Alert turned on.' : 'Alert turned off.', { title: 'Settings saved' })
    } catch (err) {
      setPrefs(previous)
      toast.error(err instanceof Error ? err.message : 'Something went wrong.', {
        title: 'Not saved',
      })
    } finally {
      setPrefsSaving(null)
    }
  }

  const revokeDevice = async (device: Device) => {
    setDeviceBusyId(device.id)
    try {
      const res = await fetch(`/api/auth/devices/${device.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (res.status === 404) {
        reloadDevices()
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Could not sign out that device.')
      }

      setDevices((list) => list?.filter((item) => item.id !== device.id) ?? null)
      toast.success(`${device.deviceName} was signed out.`, { title: 'Device signed out' })
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeviceBusyId(null)
    }
  }

  const revokeOthers = async () => {
    setDeviceBusyId(-1)
    try {
      const res = await fetch('/api/auth/devices/logout-others', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Could not sign out your other devices.')
      }

      setDevices((list) => list?.filter((item) => item.current) ?? null)
      setConfirmOthers(false)
      toast.success('You were signed out of all other devices.', { title: 'Devices signed out' })
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeviceBusyId(null)
    }
  }

  const signOutHere = async () => {
    setDeviceBusyId(-2)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (!res.ok && res.status !== 401) {
        throw new Error('Could not sign you out. Try again.')
      }

      navigate('/login', { replace: true })
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Something went wrong.')
      setDeviceBusyId(null)
    }
  }

  const beginVerification = async () => {
    setVerificationError(null)
    setVerificationLoading(true)
    try {
      await requestVerificationCode()
      navigate('/verify-email', { state: { email, returnTo: '/profile#security' } })
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setVerificationLoading(false)
    }
  }

  const startEditingProfile = () => {
    setProfileForm({
      fullname: (user?.fullname || user?.name || '').trim(),
      phone: user?.phone?.trim() || '',
    })
    setProfileFieldErrors({})
    setProfileError(null)
    setEditingProfile(true)
  }

  const cancelEditingProfile = () => {
    setEditingProfile(false)
    setProfileFieldErrors({})
    setProfileError(null)
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileFieldErrors({})

    const fullname = profileForm.fullname.trim().replace(/\s+/g, ' ')
    const phone = profileForm.phone.trim()
    const clientErrors: Record<string, string> = {}
    if (fullname.split(' ').filter(Boolean).length < 2) {
      clientErrors.fullname = 'Enter your first and last name.'
    }
    if (fullname.length > 120) {
      clientErrors.fullname = 'Name must be 120 characters or fewer.'
    }
    if (!/^\+?[0-9\s-]{7,20}$/.test(phone)) {
      clientErrors.phone = 'Enter a valid phone number.'
    }
    if (Object.keys(clientErrors).length) {
      setProfileFieldErrors(clientErrors)
      return
    }

    if (fullname === (user?.fullname || '').trim() && phone === (user?.phone || '').trim()) {
      setEditingProfile(false)
      return
    }

    setProfileSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fullname, phone }),
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const rawErrors = (data?.errors ?? {}) as Record<string, unknown>
        const fromApi: Record<string, string> = {}

        for (const [key, value] of Object.entries(rawErrors)) {
          const msg = Array.isArray(value) ? value[0] : value
          if (typeof msg === 'string') fromApi[key] = msg
        }

        if (Object.keys(fromApi).length) {
          setProfileFieldErrors(fromApi)
          setProfileError('Please fix the highlighted fields.')
          return
        }
        throw new Error(data.message ?? 'Could not update your profile.')
      }

      const payload = await res.json()
      if (!payload?.data) throw new Error('Could not update your profile.')
      setUser(payload.data as UserProfile)
      setEditingProfile(false)
      setActivityReloadKey((n) => n + 1)
      toast.success('Your details have been saved.', { title: 'Profile updated' })
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setAvatarError(null)
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Choose a PNG, JPEG or WebP image.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('That image is larger than 5 MB.')
      return
    }

    setAvatarBusy(true)
    try {
      const blob = await toSquareJpeg(file)
      const res = await fetch('/api/auth/avatar', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'image/jpeg', Accept: 'application/json' },
        body: blob,
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Could not upload your photo.')
      }

      const payload = await res.json()
      if (!payload?.data) throw new Error('Could not upload your photo.')
      setUser((prev) => ({ ...prev, ...payload.data }))
      setActivityReloadKey((n) => n + 1)
      toast.success('Your profile photo has been updated.', { title: 'Photo updated' })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Could not remove your photo.')
      }

      const payload = await res.json()
      if (!payload?.data) throw new Error('Could not remove your photo.')
      setUser((prev) => ({ ...prev, ...payload.data }))
      setActivityReloadKey((n) => n + 1)
      toast.success('Your profile photo has been removed.', { title: 'Photo removed' })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/auth/privacy/export', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) throw new Error('Could not prepare your data. Try again.')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'spurs-account-data.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      setActivityReloadKey((n) => n + 1)
      toast.success('Your data file has been downloaded.', { title: 'Download ready' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.', {
        title: 'Download failed',
      })
    } finally {
      setExporting(false)
    }
  }

  const closeDelete = () => {
    setDeleteOpen(false)
    setDeletePassword('')
    setDeleteError(null)
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError(null)

    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const raw = data?.errors?.password
        const msg = Array.isArray(raw) ? raw[0] : raw
        throw new Error(
          typeof msg === 'string' ? msg : (data.message ?? 'Could not delete your account.'),
        )
      }

      toast.success('Your account has been deleted.', { title: 'Account deleted' })
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeleting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordFieldErrors({})

    if (!passwordForm.currentPassword) {
      setPasswordFieldErrors({ current_password: 'Enter your current password.' })
      return
    }

    if (passwordForm.password.length < 8) {
      setPasswordFieldErrors({ password: 'Password must be at least 8 characters.' })
      return
    }

    if (passwordForm.password !== passwordForm.passwordConfirmation) {
      setPasswordFieldErrors({ password_confirmation: 'Passwords do not match.' })
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          password: passwordForm.password,
          password_confirmation: passwordForm.passwordConfirmation,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const rawErrors = (data?.errors ?? {}) as Record<string, unknown>
        const fieldErrorsFromApi: Record<string, string> = {}

        for (const [key, value] of Object.entries(rawErrors)) {
          const msg = Array.isArray(value) ? value[0] : value
          if (typeof msg === 'string') fieldErrorsFromApi[key] = msg
        }

        if (Object.keys(fieldErrorsFromApi).length) {
          setPasswordFieldErrors(fieldErrorsFromApi)
          setPasswordError('Please fix the highlighted fields.')
          return
        }

        throw new Error(data.message ?? 'Could not update your password.')
      }

      setPasswordForm({ currentPassword: '', password: '', passwordConfirmation: '' })
      setPasswordFieldErrors({})
      setPasswordError(null)
      setPasswordSuccess('Your password has been updated.')
      setChangePasswordOpen(false)
      setActivityReloadKey((n) => n + 1)
      toast.success('Your password has been updated.', { title: 'Password changed' })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="profile-state" data-theme={theme} role="status">
        Loading your account…
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-state" data-theme={theme}>
        <h1>Profile unavailable</h1>
        <p>{error} Check your connection and try again.</p>
        <div className="profile-state-actions">
          <button type="button" className="profile-button is-primary" onClick={retry}>
            Try again
          </button>
          <button
            type="button"
            className="profile-button"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const fullName = (user.fullname || user.name || '').trim()
  const displayName = fullName || 'Spurs user'
  const firstName = displayName.split(/\s+/)[0]
  const email = user.email?.trim() || ''
  const phone = user.phone?.trim() || ''
  const accountTypeValue = user.accountType || user.account_type || 'Standard'
  const accountType = accountTypeValue === 'user' ? 'Standard' : accountTypeValue
  const verified = Boolean(user.isVerified)
  const avatarUrl = user.avatarUrl || null
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'S'

  const checklist = [
    { label: 'Name added', done: Boolean(fullName) },
    { label: 'Email on file', done: Boolean(email) },
    { label: 'Phone number added', done: Boolean(phone) },
  ]
  const completed = checklist.filter((item) => item.done).length
  const progress = Math.round((completed / checklist.length) * 100)

  const notProvided = <span className="profile-empty-value">Not provided</span>
  const unavailable = <span className="profile-empty-value">Not available yet</span>

  const pageHead = (title: string, description: string) => (
    <header className="profile-page-head">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )

  return (
    <div className="profile-shell" data-theme={theme}>
      <header className="profile-header">
        <a className="profile-logo" href="#overview">
          <span className="profile-logo-mark" aria-hidden="true">
            S
          </span>
          <span>
            Spurs <span className="profile-logo-light">Account</span>
          </span>
        </a>

        <button
          className="profile-theme-toggle"
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label="Dark theme"
          title="Dark theme"
          onClick={toggleTheme}
        >
          <Icon name="moon" />
        </button>

        <span className="profile-avatar-small" title={displayName}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span aria-hidden="true">{initials}</span>}
          <span className="profile-sr">{displayName}</span>
        </span>
      </header>

      <div className="profile-body">
        <nav className="profile-nav" aria-label="Account sections">
          {views.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </a>
          ))}
        </nav>

        <main className="profile-main" ref={mainRef} tabIndex={-1}>
          <div className="profile-content">
            {view === 'overview' && (
              <>
                <header className="profile-hero">
                  <div className="profile-avatar-large" aria-hidden="true">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
                  </div>
                  <h1>Welcome, {firstName}</h1>
                  <p>Review your account details and keep your account secure.</p>
                </header>

                <div className="profile-stack">
                  {!verified && (
                    <a className="profile-banner" href="#security">
                      <Icon name="alert" />
                      <span>Verify your email address to help keep your account secure.</span>
                      <Icon name="chevron" />
                    </a>
                  )}

                  <section className="profile-card profile-card-pad" aria-labelledby="completeness-title">
                    <div className="profile-card-title-row">
                      <h2 id="completeness-title">Profile completeness</h2>
                      <span className="profile-count">
                        {completed} of {checklist.length} done
                      </span>
                    </div>
                    <div
                      className="profile-progress"
                      role="progressbar"
                      aria-label="Profile completeness"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <ul className="profile-steps">
                      {checklist.map((item) => (
                        <li key={item.label} className={item.done ? 'is-complete' : ''}>
                          <Icon name={item.done ? 'done' : 'todo'} />
                          <span className="profile-sr">{item.done ? 'Done: ' : 'Not done: '}</span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="profile-tiles">
                    <a className="profile-tile" href="#personal">
                      <span className="profile-tile-icon">
                        <Icon name="person" />
                      </span>
                      <span className="profile-tile-text">
                        <strong>Personal info</strong>
                        <span>Name, email address, and phone number saved on your account.</span>
                      </span>
                      <Icon name="chevron" />
                    </a>

                    <a className="profile-tile" href="#security">
                      <span className="profile-tile-icon">
                        <Icon name="security" />
                      </span>
                      <span className="profile-tile-text">
                        <strong>Security</strong>
                        <span>
                          <StatusChip verified={verified} />
                        </span>
                      </span>
                      <Icon name="chevron" />
                    </a>

                    <a className="profile-tile" href="#privacy">
                      <span className="profile-tile-icon">
                        <Icon name="privacy" />
                      </span>
                      <span className="profile-tile-text">
                        <strong>Data &amp; privacy</strong>
                        <span>See the profile data this account holds.</span>
                      </span>
                      <Icon name="chevron" />
                    </a>

                    <a className="profile-tile" href="#apps">
                      <span className="profile-tile-icon">
                        <Icon name="apps" />
                      </span>
                      <span className="profile-tile-text">
                        <strong>Connected apps</strong>
                        <span>Apps that have access to your account.</span>
                      </span>
                      <Icon name="chevron" />
                    </a>
                  </div>
                </div>
              </>
            )}

            {view === 'personal' && (
              <>
                {pageHead(
                  'Personal info',
                  'Update your name and phone number. Your email and account type can’t be changed here.',
                )}
                <section className="profile-card" aria-labelledby="basic-title">
                  <div className="profile-card-head has-action">
                    <h2 id="basic-title">Basic info</h2>
                    {!editingProfile && (
                      <button
                        type="button"
                        className="profile-button is-small"
                        onClick={startEditingProfile}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="profile-avatar-edit">
                    <div className="profile-avatar-preview">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Your profile photo" />
                      ) : (
                        <span aria-hidden="true">{initials}</span>
                      )}
                    </div>

                    <div className="profile-avatar-actions">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="profile-sr"
                        tabIndex={-1}
                        onChange={(e) => void handleAvatarChange(e)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="profile-button is-small"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarBusy}
                        >
                          {avatarBusy ? 'Working…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                        </button>
                        {avatarUrl && (
                          <button
                            type="button"
                            className="profile-button is-small"
                            onClick={() => void handleAvatarRemove()}
                            disabled={avatarBusy}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <span className="profile-empty-value">
                        PNG, JPEG or WebP, up to 5 MB. It’s cropped to a square.
                      </span>
                      {avatarError && (
                        <span role="alert" className="text-xs font-normal text-red-600">
                          {avatarError}
                        </span>
                      )}
                    </div>
                  </div>
                  {editingProfile ? (
                    <form onSubmit={handleProfileSave} noValidate className="profile-form">
                      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        Full name
                        <input
                          type="text"
                          autoComplete="name"
                          autoFocus
                          value={profileForm.fullname}
                          onChange={(e) => {
                            setProfileForm((prev) => ({ ...prev, fullname: e.target.value }))
                            if (profileFieldErrors.fullname) {
                              setProfileFieldErrors((prev) => ({ ...prev, fullname: '' }))
                            }
                          }}
                          aria-invalid={!!profileFieldErrors.fullname}
                          className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${profileFieldErrors.fullname ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                        />
                        {profileFieldErrors.fullname && (
                          <span role="alert" className="text-xs font-normal text-red-600">
                            {profileFieldErrors.fullname}
                          </span>
                        )}
                      </label>

                      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        Phone number
                        <input
                          type="tel"
                          autoComplete="tel"
                          placeholder="0801 234 5678"
                          value={profileForm.phone}
                          onChange={(e) => {
                            setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                            if (profileFieldErrors.phone) {
                              setProfileFieldErrors((prev) => ({ ...prev, phone: '' }))
                            }
                          }}
                          aria-invalid={!!profileFieldErrors.phone}
                          className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${profileFieldErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                        />
                        {profileFieldErrors.phone && (
                          <span role="alert" className="text-xs font-normal text-red-600">
                            {profileFieldErrors.phone}
                          </span>
                        )}
                      </label>

                      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        Email
                        <span className="profile-empty-value">{email} · can’t be changed here</span>
                      </div>

                      {profileError && (
                        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                          {profileError}
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="profile-button"
                          onClick={cancelEditingProfile}
                          disabled={profileSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="profile-button is-primary"
                          disabled={profileSaving}
                        >
                          {profileSaving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className="profile-rows">
                      <div>
                        <dt>Name</dt>
                        <dd>{fullName || notProvided}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{email || notProvided}</dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>{phone || notProvided}</dd>
                      </div>
                      <div>
                        <dt>Account type</dt>
                        <dd className="profile-capitalize">{accountType}</dd>
                      </div>
                    </dl>
                  )}
                </section>
              </>
            )}

            {view === 'security' && (
              <>
                {pageHead('Security', 'Sign-in and verification details for your account.')}
                <div className="profile-stack">
                  <section className="profile-card" aria-labelledby="signin-title">
                    <div className="profile-card-head">
                      <h2 id="signin-title">How you sign in</h2>
                    </div>
                    <dl className="profile-rows">
                      <div>
                        <dt>Email verification</dt>
                        <dd className="profile-inline">
                          <span className="profile-inline-summary">
                            <StatusChip verified={verified} />
                            {email && <span>{email}</span>}
                          </span>
                          {!verified && (
                            <span className="profile-inline-actions">
                              <button
                                type="button"
                                className="profile-button is-primary"
                                onClick={beginVerification}
                                disabled={verificationLoading}
                              >
                                {verificationLoading ? 'Sending code…' : 'Verify email'}
                              </button>
                              {verificationError && (
                                <span role="alert" className="profile-empty-value">
                                  {verificationError}
                                </span>
                              )}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Password</dt>
                        <dd className="profile-inline">
                          <span className="profile-inline-summary">
                            <span className="profile-empty-value">••••••••</span>
                          </span>
                          <span className="profile-inline-actions">
                            <button
                              type="button"
                              className="profile-button is-primary"
                              onClick={() => {
                                setPasswordError(null)
                                setPasswordSuccess(null)
                                setChangePasswordOpen((open) => !open)
                              }}
                            >
                              {changePasswordOpen ? 'Close' : 'Change password'}
                            </button>
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Two-step verification</dt>
                        <dd>{unavailable}</dd>
                      </div>
                    </dl>
                  </section>

                  {changePasswordOpen && (
                    <section className="profile-card" aria-labelledby="password-title">
                      <div className="profile-card-head">
                        <h2 id="password-title">Change password</h2>
                      </div>

                      <form onSubmit={handlePasswordChange} className="profile-stack">
                        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                          Current password
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => {
                              setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                              if (passwordFieldErrors.current_password) {
                                setPasswordFieldErrors((prev) => ({ ...prev, current_password: '' }))
                              }
                            }}
                            aria-invalid={!!passwordFieldErrors.current_password}
                            className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${passwordFieldErrors.current_password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                          />
                          {passwordFieldErrors.current_password && (
                            <span role="alert" className="text-xs font-normal text-red-600">
                              {passwordFieldErrors.current_password}
                            </span>
                          )}
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                          New password
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.password}
                            onChange={(e) => {
                              setPasswordForm((prev) => ({ ...prev, password: e.target.value }))
                              if (passwordFieldErrors.password) {
                                setPasswordFieldErrors((prev) => ({ ...prev, password: '' }))
                              }
                            }}
                            aria-invalid={!!passwordFieldErrors.password}
                            className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${passwordFieldErrors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                          />
                          {passwordFieldErrors.password && (
                            <span role="alert" className="text-xs font-normal text-red-600">
                              {passwordFieldErrors.password}
                            </span>
                          )}
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                          Confirm new password
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.passwordConfirmation}
                            onChange={(e) => {
                              setPasswordForm((prev) => ({
                                ...prev,
                                passwordConfirmation: e.target.value,
                              }))
                              if (passwordFieldErrors.password_confirmation) {
                                setPasswordFieldErrors((prev) => ({
                                  ...prev,
                                  password_confirmation: '',
                                }))
                              }
                            }}
                            aria-invalid={!!passwordFieldErrors.password_confirmation}
                            className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${passwordFieldErrors.password_confirmation ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                          />
                          {passwordFieldErrors.password_confirmation && (
                            <span role="alert" className="text-xs font-normal text-red-600">
                              {passwordFieldErrors.password_confirmation}
                            </span>
                          )}
                        </label>

                        {passwordError && (
                          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                            {passwordError}
                          </p>
                        )}

                        {passwordSuccess && (
                          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                            {passwordSuccess}
                          </p>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={passwordLoading}
                            className="profile-button is-primary"
                          >
                            {passwordLoading ? 'Updating…' : 'Update password'}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}

                  <section className="profile-card" aria-labelledby="alerts-title">
                    <div className="profile-card-head">
                      <h2 id="alerts-title">Preferences</h2>
                      <h3 className="profile-pref-heading">Sign-in alerts</h3>
                      <p>Get an email when someone signs in to your account.</p>
                    </div>

                    {prefsError ? (
                      <div className="profile-device-state" role="alert">
                        <span>{prefsError}</span>
                        <button
                          type="button"
                          className="profile-button is-small"
                          onClick={() => setPrefsReloadKey((n) => n + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : prefs === null ? (
                      <div className="profile-device-state" role="status">Loading settings…</div>
                    ) : (
                      <>
                        <label className="profile-pref">
                          <span className="profile-pref-text">
                            <strong>Every sign-in</strong>
                            <span>Email me each time my account is signed in to.</span>
                          </span>
                          <span className="profile-switch">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={prefs.loginAlerts}
                              disabled={prefsSaving !== null}
                              onChange={(e) => void updatePreference('loginAlerts', e.target.checked)}
                            />
                            <span className="profile-switch-track" aria-hidden="true" />
                          </span>
                        </label>

                        <label className="profile-pref">
                          <span className="profile-pref-text">
                            <strong>New devices only</strong>
                            <span>
                              Email me when a sign-in comes from a device I haven’t used before.
                              {prefs.loginAlerts && ' Already covered by “Every sign-in”.'}
                            </span>
                          </span>
                          <span className="profile-switch">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={prefs.newDeviceAlerts}
                              disabled={prefsSaving !== null}
                              onChange={(e) => void updatePreference('newDeviceAlerts', e.target.checked)}
                            />
                            <span className="profile-switch-track" aria-hidden="true" />
                          </span>
                        </label>
                      </>
                    )}
                  </section>

                  <section className="profile-card" aria-labelledby="devices-title">
                    <div className="profile-card-head">
                      <h2 id="devices-title">Your devices</h2>
                      <p>Where your account is signed in right now. Sign out of any device you don’t recognise.</p>
                    </div>

                    {devicesError ? (
                      <div className="profile-device-state" role="alert">
                        <span>{devicesError}</span>
                        <button type="button" className="profile-button is-small" onClick={reloadDevices}>
                          Try again
                        </button>
                      </div>
                    ) : devices === null && devicesLoading ? (
                      <div className="profile-device-state" role="status">
                        Loading devices…
                      </div>
                    ) : devices === null ? (
                      <div className="profile-device-state" role="status">
                        No devices found.
                      </div>
                    ) : (() => {
                        const sorted = [...devices].sort(
                          (a, b) => Number(b.current) - Number(a.current),
                        )
                        const others = sorted.filter((device) => !device.current)

                        return (
                          <>
                            {others.length > 0 && (
                              <div className="profile-device-toolbar">
                                {confirmOthers ? (
                                  <>
                                    <span>
                                      Sign out {others.length} other {others.length === 1 ? 'device' : 'devices'}?
                                    </span>
                                    <div className="profile-device-actions">
                                      <button
                                        type="button"
                                        className="profile-button is-small"
                                        onClick={() => setConfirmOthers(false)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="profile-button is-primary is-small"
                                        onClick={() => void revokeOthers()}
                                        disabled={deviceBusyId !== null}
                                      >
                                        {deviceBusyId === -1 ? 'Signing out…' : 'Sign out all others'}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="profile-button is-primary is-small"
                                    onClick={() => setConfirmOthers(true)}
                                  >
                                    Sign out all others
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="profile-device-list">
                              {sorted.map((device) => (
                                <div
                                  key={device.id}
                                  className={`profile-device ${device.current ? 'is-current' : ''}`}
                                >
                                  <div className="profile-device-icon">
                                    <DeviceIcon phone={isPhone(device.deviceName)} />
                                  </div>

                                  <div className="profile-device-main">
                                    <div className="profile-device-row">
                                      <strong>{device.deviceName || 'Unknown device'}</strong>
                                      {device.current && (
                                        <span className="profile-chip is-good">Current</span>
                                      )}
                                    </div>
                                    <div className="profile-device-meta">
                                      <span>{device.ipAddress || 'Unknown location'}</span>
                                      <span>•</span>
                                      <span>
                                        {device.lastUsedAt ? `Last used ${timeAgo(device.lastUsedAt)}` : 'Recently used'}
                                      </span>
                                    </div>
                                    <div className="profile-device-meta">
                                      <span>Signed in {formatDate(device.signedInAt)}</span>
                                      {device.expiresAt && (
                                        <>
                                          <span>•</span>
                                          <span>Expires {formatDate(device.expiresAt)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="profile-device-actions">
                                    {device.current ? (
                                      <button
                                        type="button"
                                        className="profile-button is-small"
                                        onClick={() => void signOutHere()}
                                        disabled={deviceBusyId !== null}
                                      >
                                        {deviceBusyId === -2 ? 'Signing out…' : 'Sign out'}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="profile-button is-small"
                                        onClick={() => void revokeDevice(device)}
                                        disabled={deviceBusyId === device.id}
                                      >
                                        {deviceBusyId === device.id ? 'Signing out…' : 'Sign out'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                  </section>
                </div>
              </>
            )}

            {view === 'privacy' && (
              <>
                {pageHead(
                  'Data & privacy',
                  'The profile data this account holds and the controls available.',
                )}
                <div className="profile-stack">
                  <section className="profile-card" aria-labelledby="data-title">
                    <div className="profile-card-head">
                      <h2 id="data-title">Profile data</h2>
                      <p>
                        This page shows the name, email address, phone number, verification status,
                        and account type saved on your account.
                      </p>
                    </div>
                    <a className="profile-link-row" href="#personal">
                      Review personal info
                      <Icon name="chevron" />
                    </a>
                  </section>

                  <section className="profile-card" aria-labelledby="controls-title">
                    <div className="profile-card-head">
                      <h2 id="controls-title">Privacy controls</h2>
                      <p>Take a copy of your data, manage sign-in alerts, or close your account.</p>
                    </div>
                    <dl className="profile-rows">
                      <div>
                        <dt>Download your data</dt>
                        <dd className="profile-inline">
                          <span className="profile-inline-summary">
                            <span className="profile-empty-value">
                              A JSON file with your profile, preferences, devices and activity.
                            </span>
                          </span>
                          <span className="profile-inline-actions">
                            <button
                              type="button"
                              className="profile-button is-small"
                              onClick={() => void handleExport()}
                              disabled={exporting}
                            >
                              {exporting ? 'Preparing…' : 'Download'}
                            </button>
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Sign-in alerts</dt>
                        <dd className="profile-inline">
                          <span className="profile-inline-summary">
                            <span className="profile-empty-value">
                              Choose when we email you about sign-ins.
                            </span>
                          </span>
                          <span className="profile-inline-actions">
                            <button
                              type="button"
                              className="profile-button is-small"
                              onClick={() => {
                                window.location.hash = 'security'
                              }}
                            >
                              Manage
                            </button>
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Delete account</dt>
                        <dd className="profile-inline">
                          <span className="profile-inline-summary">
                            <span className="profile-empty-value">
                              Permanently remove your account and its data.
                            </span>
                          </span>
                          <span className="profile-inline-actions">
                            <button
                              type="button"
                              className="profile-button is-danger is-small"
                              onClick={() => (deleteOpen ? closeDelete() : setDeleteOpen(true))}
                            >
                              {deleteOpen ? 'Cancel' : 'Delete account'}
                            </button>
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {deleteOpen && (
                    <section className="profile-card" aria-labelledby="delete-title">
                      <div className="profile-card-head">
                        <h2 id="delete-title">Delete your account</h2>
                        <p>
                          This permanently deletes your profile, photo, devices and activity, and
                          signs you out everywhere. It can’t be undone. Download your data first if
                          you want a copy.
                        </p>
                      </div>

                      <form onSubmit={handleDeleteAccount} noValidate className="profile-form">
                        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                          Confirm with your password
                          <input
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            value={deletePassword}
                            onChange={(e) => {
                              setDeletePassword(e.target.value)
                              if (deleteError) setDeleteError(null)
                            }}
                            aria-invalid={!!deleteError}
                            className={`rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 ${deleteError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                          />
                        </label>

                        {deleteError && (
                          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                            {deleteError}
                          </p>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="profile-button"
                            onClick={closeDelete}
                            disabled={deleting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="profile-button is-danger is-primary"
                            disabled={deleting}
                          >
                            {deleting ? 'Deleting…' : 'Delete permanently'}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}

                  <section className="profile-card" aria-labelledby="activity-title">
                    <div className="profile-card-head">
                      <h2 id="activity-title">Recent activity</h2>
                      <p>Sign-ins and security changes on your account.</p>
                    </div>

                    {activityError ? (
                      <div className="profile-device-state" role="alert">
                        <span>{activityError}</span>
                        <button
                          type="button"
                          className="profile-button is-small"
                          onClick={() => setActivityReloadKey((n) => n + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : activity === null || activityLoading ? (
                      <div className="profile-device-state" role="status">Loading activity…</div>
                    ) : activity.length === 0 ? (
                      <div className="profile-device-state" role="status">No activity yet.</div>
                    ) : (
                      <dl className="profile-rows">
                        {activity.map((item) => (
                          <div key={item.id}>
                            <dt>{formatDateTime(item.createdAt)}</dt>
                            <dd>
                              {EVENT_LABELS[item.event] ?? item.event}
                              <span className="profile-empty-value">
                                {' · '}
                                {[item.deviceName, item.ipAddress].filter(Boolean).join(' · ') || 'Unknown device'}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </section>
                </div>
              </>
            )}

            {view === 'apps' && (
              <>
                {pageHead('Connected apps', 'Apps that have access to your account.')}
                <section className="profile-card profile-empty">
                  <span className="profile-tile-icon is-large">
                    <Icon name="apps" />
                  </span>
                  <h2>Nothing to manage yet</h2>
                  <p>Connected apps and access controls aren’t available for this account yet.</p>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Profile