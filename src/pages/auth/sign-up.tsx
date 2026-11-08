// src/pages/Signup.tsx
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/layout'
import BG from '../../assets/bg-2.jpg'
import { getRedirectTarget, requestVerificationCode } from '../../lib/auth'

type FormState = {
  fullName: string
  email: string
  phone: string
  password: string
  acceptTerms: boolean
}

type FieldName = keyof FormState
type FieldErrors = Partial<Record<FieldName, string>>

// Server (Laravel-style) key -> form key
const SERVER_FIELD_MAP: Record<string, FieldName> = {
  fullname: 'fullName',
  fullName: 'fullName',
  email: 'email',
  phone: 'phone',
  password: 'password',
}

// Turns { fullname: ['msg', ...], email: 'msg' } into { fullName: 'msg', email: 'msg' }
const parseServerErrors = (raw: unknown): FieldErrors => {
  const out: FieldErrors = {}
  if (!raw || typeof raw !== 'object') return out

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = SERVER_FIELD_MAP[key]
    if (!field) continue
    const msg = Array.isArray(value) ? value[0] : value
    if (typeof msg === 'string') out[field] = msg
  }
  return out
}

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
const inputErrorClass =
  'border-red-500 focus:border-red-500 focus:ring-red-500/20'

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <span role="alert" className="text-xs font-normal text-red-600">
      {message}
    </span>
  ) : null

const Signup = () => {
  const navigate = useNavigate()
  const { search } = useLocation() // keeps client_id, redirect_uri, etc.

  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    acceptTerms: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null) // general / banner error
  const [errors, setErrors] = useState<FieldErrors>({}) // per-field errors
  const [loading, setLoading] = useState(false)

  const update =
    (field: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [field]: value }))
      // clear this field's error as soon as the user edits it
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    }

  const fieldClass = (field: FieldName, extra = '') =>
    `${inputClass} ${extra} ${errors[field] ? inputErrorClass : ''}`.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrors({})

    // Client-side checks
    const clientErrors: FieldErrors = {}
    if (form.password.length < 8) {
      clientErrors.password = 'Password must be at least 8 characters.'
    }
    if (!form.acceptTerms) {
      clientErrors.acceptTerms = 'Please accept the Terms and Privacy Policy to continue.'
    }
    if (Object.keys(clientErrors).length) {
      return setErrors(clientErrors)
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname: form.fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          password_confirmation: form.password
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const fieldErrors = parseServerErrors(data.errors)

        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors)
          setError('Please fix the highlighted fields.')
        } else {
          setError(data.message ?? 'Could not create your account. Try again.')
        }
        return
      }

      const email = form.email.trim()

      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: form.password }),
        })
        if (!loginRes.ok) throw new Error('Auto sign-in failed')

        await requestVerificationCode()
      } catch {
        navigate(`/login${search}`, {
          replace: true,
          state: { registered: true, email },
        })
        return
      }

      navigate(`/verify-email${search}`, {
        replace: true,
        state: { email, returnTo: getRedirectTarget(search) },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const clientName = 'VendPro'

  return (
    <AuthLayout
      image={BG}
      heroTitle={<>Create your account.<br />Start in minutes.</>}
      heroText="One secure account gives you access to every Spurs app, with no separate sign-ups."
    >
      <div className="card flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">Create your account</h2>
          <p className="text-sm text-gray-500">
            to continue to <span className="font-medium text-gray-700">{clientName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Full name
            <input
              type="text"
              autoComplete="name"
              required
              aria-invalid={!!errors.fullName}
              value={form.fullName}
              onChange={update('fullName')}
              className={fieldClass('fullName')}
            />
            <FieldError message={errors.fullName} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              value={form.email}
              onChange={update('email')}
              className={fieldClass('email')}
            />
            <FieldError message={errors.email} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone number
            <input
              type="tel"
              autoComplete="tel"
              required
              placeholder="0801 234 5678"
              aria-invalid={!!errors.phone}
              value={form.phone}
              onChange={update('phone')}
              className={fieldClass('phone')}
            />
            <FieldError message={errors.phone} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
                aria-invalid={!!errors.password}
                value={form.password}
                onChange={update('password')}
                className={fieldClass('password', 'w-full pr-16')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 hover:underline"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <FieldError message={errors.password} />
          </label>

          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={update('acceptTerms')}
                className="mt-0.5"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
              </span>
            </label>
            <FieldError message={errors.acceptTerms} />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <Link
              to={`/login${search}`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Sign in instead
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}

export default Signup