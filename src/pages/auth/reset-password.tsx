import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/layout'
import BG from '../../assets/bg-2.jpg'
import { toast } from '../../lib/toast'

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
const inputErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20'

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <span role="alert" className="text-xs font-normal text-red-600">
      {message}
    </span>
  ) : null

const ResetPassword = () => {
  const navigate = useNavigate()
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validLink = Boolean(email && token)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!validLink) {
      setError('This password reset link is invalid or has expired.')
      return
    }

    if (password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' })
      return
    }

    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: 'Passwords do not match.' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
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
          setFieldErrors(fieldErrorsFromApi)
          setError('Please fix the highlighted fields.')
          return
        }

        throw new Error(data.message ?? 'Could not reset your password. Try again.')
      }

      toast.success('Your password has been reset. You can now sign in.', {
        title: 'Password reset',
      })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      image={BG}
      heroTitle={<>Set a new password.<br />You’re almost done.</>}
      heroText="Choose a strong password you haven’t used before for this account."
    >
      <div className="card flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">Reset your password</h2>
          <p className="text-sm text-gray-500">
            {validLink ? `Using ${email}.` : 'This link is no longer valid.'}
          </p>
        </div>

        {validLink ? (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                autoFocus
                placeholder="At least 8 characters"
                aria-invalid={!!fieldErrors.password}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
                }}
                className={`${inputClass} ${fieldErrors.password ? inputErrorClass : ''}`.trim()}
              />
              <FieldError message={fieldErrors.password} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                placeholder="Repeat your new password"
                aria-invalid={!!fieldErrors.password_confirmation}
                value={passwordConfirmation}
                onChange={(e) => {
                  setPasswordConfirmation(e.target.value)
                  if (fieldErrors.password_confirmation) {
                    setFieldErrors((prev) => ({ ...prev, password_confirmation: '' }))
                  }
                }}
                className={`${inputClass} ${fieldErrors.password_confirmation ? inputErrorClass : ''}`.trim()}
              />
              <FieldError message={fieldErrors.password_confirmation} />
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link to="/login" className="text-sm font-medium text-blue-600 hover:underline">
                Back to sign in
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Link
              to="/login"
              className="rounded-lg bg-blue-600 px-6 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}

export default ResetPassword
