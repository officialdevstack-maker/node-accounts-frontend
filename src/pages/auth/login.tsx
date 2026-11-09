// src/App.tsx
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import heroBg from '../../assets/bg-1.jpg'
import { followRedirect, getRedirectTarget } from '../../lib/auth'
import { useClientInfo } from '../../lib/useClientInfo'

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

const parseServerErrors = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const msg = Array.isArray(value) ? value[0] : value
    if (typeof msg === 'string') out[key] = msg
  }

  return out
}

const Login = () => {
  const navigate = useNavigate()
  const { search, state } = useLocation()
  const BRAND = 'Spurs'
  const { name: clientName } = useClientInfo(search)

  const [form, setForm] = useState(() => ({
    email: new URLSearchParams(search).get('login_hint') ?? '',
    password: '',
  }))
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const updateField = (field: 'email' | 'password') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrors({})

    const nextErrors: Record<string, string | undefined> = {}
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    if (!form.password) nextErrors.password = 'Password is required.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const serverErrors = parseServerErrors(data.errors)
        if (Object.keys(serverErrors).length) {
          setErrors(serverErrors)
          setError('Please fix the highlighted fields.')
          return
        }

        throw new Error(data.message ?? 'Invalid email or password.')
      }

      await res.json().catch(() => ({}))
      followRedirect(getRedirectTarget(search), navigate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid h-screen grid-cols-1 gap-5 bg-primary md:grid-cols-2">
      <div
        className="relative hidden overflow-hidden bg-cover bg-center shadow-lg md:block"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div
          className="absolute inset-0 backdrop-blur-xl"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 20%, black 80%)',
            maskImage: 'linear-gradient(to bottom, transparent 20%, black 80%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-10 text-white">
          <span className="text-sm font-medium uppercase tracking-widest opacity-80">
            {BRAND} Account
          </span>
          <h1 className="text-4xl font-semibold leading-tight">
            One account.<br />Every {BRAND} app.
          </h1>
          <p className="max-w-sm text-base opacity-90">
            Sign in once and move between your apps securely, without juggling passwords.
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-col justify-center px-6">
        <div className="card flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-gray-500">
              to continue to <span className="font-medium text-gray-700">{clientName}</span>
            </p>
          </div>

          {state?.registered && (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Account created. Sign in to verify your email.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                value={form.email}
                onChange={updateField('email')}
                className={`${inputClass} ${errors.email ? inputErrorClass : ''}`.trim()}
              />
              <FieldError message={errors.email} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Password
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  aria-invalid={!!errors.password}
                  value={form.password}
                  onChange={updateField('password')}
                  className={`${inputClass} w-full pr-16 ${errors.password ? inputErrorClass : ''}`.trim()}
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

            <div className="flex items-center justify-between gap-4">
              <Link to={`/forgot-password${search}`} className="text-sm font-medium text-blue-600 hover:underline">
                Forgot password?
              </Link>
              <Link to={`/signup${search}`} className="text-sm font-medium text-blue-600 hover:underline">
                Create account
              </Link>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="flex justify-between border-t pt-4 text-xs text-gray-500">
            <span>English (Nigeria)</span>
            <div className="flex gap-4">
              <a href="/help" className="hover:underline">Help</a>
              <a href="/privacy" className="hover:underline">Privacy</a>
              <a href="/terms" className="hover:underline">Terms</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login;