// src/pages/auth/VerifyEmail.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/layout'
import BG from '../../assets/bg-2.jpg'
import { followRedirect, getRedirectTarget } from '../../lib/auth'
import { toast } from '../../lib/toast'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

const maskEmail = (email: string) => {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`
}

const VerifyEmail = () => {
  const navigate = useNavigate()
  const { search, state } = useLocation() // search keeps client_id, redirect_uri, etc.
  const [email, setEmail] = useState<string | undefined>(state?.email)
  const [resolving, setResolving] = useState(!state?.email)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const returnTo: string = state?.returnTo ?? getRedirectTarget(search)

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)

  const inputs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (email) return
    let alive = true

    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (res.status === 401) return
        if (!res.ok) throw new Error('Could not load your account.')

        const payload = await res.json()
        const user = payload?.data ?? payload
        if (!alive) return
        if (user?.isVerified) {
          navigate('/profile#security', { replace: true })
          return
        }
        if (typeof user?.email !== 'string') {
          throw new Error('Your account profile did not include an email address.')
        }
        setEmail(user.email)
      } catch (err) {
        if (alive) {
          setResolveError(err instanceof Error ? err.message : 'Could not load your account.')
        }
      } finally {
        if (alive) setResolving(false)
      }
    }

    void loadProfile()
    return () => {
      alive = false
    }
  }, [email, navigate])

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const focusAt = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(i, CODE_LENGTH - 1))]
    el?.focus()
    el?.select()
  }

  const verify = useCallback(
    async (code: string) => {
      if (!email) return
      setError(null)
      setInfo(null)
      setLoading(true)
      try {
        const res = await fetch(`/api/auth/verify-email/confirm`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))

          // Laravel-style: { errors: { code: ['msg'] } }
          const raw = data?.errors?.code
          const fieldMsg = Array.isArray(raw) ? raw[0] : raw

          setDigits(Array(CODE_LENGTH).fill(''))
          setTimeout(() => focusAt(0), 0)

          if (res.status === 429) {
            return setError('Too many attempts. Please wait a moment and try again.')
          }
          return setError(
            typeof fieldMsg === 'string'
              ? fieldMsg
              : data.message ?? 'Invalid or expired code. Try again.'
          )
        }

        toast.success('Your email address is now confirmed.', { title: 'Email verified' })
        followRedirect(returnTo, navigate)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    },
    [email, navigate, returnTo]
  )

  // Fill boxes starting at index i with the given characters
  const fill = (start: number, chars: string) => {
    const next = [...digits]
    let last = start
    for (let k = 0; k < chars.length && start + k < CODE_LENGTH; k++) {
      next[start + k] = chars[k]
      last = start + k
    }
    setDigits(next)
    setError(null)

    if (next.every(Boolean)) {
      void verify(next.join(''))
    } else {
      focusAt(last + 1)
    }
  }

  const handleChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    if (!value) {
      const next = [...digits]
      next[i] = ''
      return setDigits(next)
    }
    // value.length > 1 covers SMS/autofill dropping the whole code into one box
    fill(i, value.length > 1 ? value : value.slice(-1))
  }

  const handleKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      const next = [...digits]
      next[i - 1] = ''
      setDigits(next)
      focusAt(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (pasted) fill(0, pasted)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== CODE_LENGTH) {
      return setError('Enter the 6-digit code we sent you.')
    }
    void verify(code)
  }

  const resend = async () => {
    if (!email || cooldown > 0 || resending) return
    setError(null)
    setInfo(null)
    setResending(true)
    try {
      const res = await fetch(`/api/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          return setError('Too many requests. Please wait a moment and try again.')
        }
        throw new Error(data.message ?? 'Could not resend the code. Try again.')
      }

      const payload: unknown = await res.json()
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('data' in payload) ||
        typeof payload.data !== 'object' ||
        payload.data === null ||
        !('sent' in payload.data) ||
        typeof payload.data.sent !== 'boolean' ||
        !('retryAfter' in payload.data) ||
        typeof payload.data.retryAfter !== 'number'
      ) {
        throw new Error('The server returned an invalid resend response.')
      }

      setInfo(
        payload.data.sent
          ? 'A new code has been sent.'
          : 'A code was sent recently. Check your inbox.'
      )
      setDigits(Array(CODE_LENGTH).fill(''))
      setCooldown(Math.max(0, payload.data.retryAfter))
      focusAt(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setResending(false)
    }
  }

  if (resolving) {
    return (
      <div role="status" className="grid min-h-screen place-items-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (resolveError) {
    return (
      <AuthLayout
        image={BG}
        heroTitle={<>Verify your email.<br />Almost there.</>}
        heroText="We sent a 6-digit code to your inbox. Enter it to confirm your Spurs account."
      >
        <div role="alert" className="card p-8 text-sm text-red-600">
          {resolveError}
        </div>
      </AuthLayout>
    )
  }

  if (!email) {
    return <Navigate to={`/login${search}`} replace />
  }

  return (
    <AuthLayout
      image={BG}
      heroTitle={<>Verify your email.<br />Almost there.</>}
      heroText="We sent a 6-digit code to your inbox. Enter it to confirm your Spurs account."
    >
      <div className="card flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">Check your email</h2>
          <p className="text-sm text-gray-500">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-gray-700">{maskEmail(email)}</span>. It expires in
            10 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Verification code</span>
            <div className="flex justify-between gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  autoFocus={i === 0}
                  maxLength={CODE_LENGTH} // allows autofill; handleChange trims to one digit
                  aria-label={`Digit ${i + 1}`}
                  aria-invalid={!!error}
                  disabled={loading}
                  value={d}
                  onChange={handleChange(i)}
                  onKeyDown={handleKeyDown(i)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                  className={`${
                    'h-12 w-full min-w-0 rounded-lg border border-gray-300 text-center text-xl font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60'
                  } ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`.trim()}
                />
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {info && (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {info}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || resending}
              className="text-sm font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
            >
              {resending
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : 'Resend code'}
            </button>
            <button
              type="submit"
              disabled={loading || digits.some((d) => !d)}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </div>
        </form>

        <div className="flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={() => followRedirect(returnTo, navigate)}
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            I'll do this later
          </button>
          <p className="text-xs text-gray-500">
            You can verify any time from Profile → Security.
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmail