// src/pages/auth/ForgotPassword.tsx
import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '../../components/auth/layout'
import BG from '../../assets/bg-2.jpg'

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ForgotPassword = () => {
  const { search } = useLocation() // keeps client_id, redirect_uri, etc.

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null) // general / banner error
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailError(undefined)

    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      return setEmailError('Enter a valid email address.')
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))

        // Laravel-style: { errors: { email: ['msg'] } }
        const raw = data?.errors?.email
        const msg = Array.isArray(raw) ? raw[0] : raw
        if (typeof msg === 'string') {
          return setEmailError(msg)
        }

        if (res.status === 429) {
          return setError('Too many attempts. Please wait a moment and try again.')
        }

        throw new Error(data.message ?? 'Could not send the reset link. Try again.')
      }

      // Server should respond 200 whether or not the email exists,
      // so we never reveal which emails are registered.
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const resend = () => {
    setSent(false)
    setError(null)
  }

  return (
    <AuthLayout
      image={BG}
      heroTitle={<>Forgot your password?<br />We've got you.</>}
      heroText="Enter the email linked to your Spurs account and we'll send you a link to set a new password."
    >
      <div className="card flex flex-col gap-6 p-8">
        {sent ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold">Check your email</h2>
              <p className="text-sm text-gray-500">
                If an account exists for{' '}
                <span className="font-medium text-gray-700">{email.trim()}</span>, we've sent a
                link to reset your password. It may take a minute to arrive, so check your spam
                folder too.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resend}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Use a different email
              </button>
              <Link
                to={`/login${search}`}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold">Reset your password</h2>
              <p className="text-sm text-gray-500">
                We'll email you a link to choose a new one.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  aria-invalid={!!emailError}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(undefined)
                  }}
                  className={`${inputClass} ${emailError ? inputErrorClass : ''}`.trim()}
                />
                <FieldError message={emailError} />
              </label>

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
                  Back to sign in
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  )
}

export default ForgotPassword