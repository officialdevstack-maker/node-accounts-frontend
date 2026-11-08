import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { requestVerificationCode } from '../lib/auth'

type UserProfile = {
  id?: number
  fullname?: string
  name?: string
  email?: string
  phone?: string | null
  isVerified?: boolean
  account_type?: string
}

type Theme = 'light' | 'dark'

const THEME_KEY = 'profile-theme'

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
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
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
  const accountType = user.account_type || 'Standard'
  const verified = Boolean(user.isVerified)
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
          <span aria-hidden="true">{initials}</span>
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
                    {initials}
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
                  'The details saved on your account. Editing isn’t available yet.',
                )}
                <section className="profile-card" aria-labelledby="basic-title">
                  <div className="profile-card-head">
                    <h2 id="basic-title">Basic info</h2>
                  </div>
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
                        <dd>{unavailable}</dd>
                      </div>
                      <div>
                        <dt>Two-step verification</dt>
                        <dd>{unavailable}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="profile-card" aria-labelledby="devices-title">
                    <div className="profile-card-head">
                      <h2 id="devices-title">Your devices</h2>
                    </div>
                    <dl className="profile-rows">
                      <div>
                        <dt>Signed-in devices</dt>
                        <dd>{unavailable}</dd>
                      </div>
                    </dl>
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
                    </div>
                    <dl className="profile-rows">
                      <div>
                        <dt>Privacy preferences</dt>
                        <dd>{unavailable}</dd>
                      </div>
                      <div>
                        <dt>Activity history</dt>
                        <dd>{unavailable}</dd>
                      </div>
                    </dl>
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