import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const cardStyle = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'

type ConsentDetails = {
  client: {
    name: string
    description: string | null
    logoUri: string | null
  }
  permissions: string[]
  user: {
    fullname: string
    email: string
  }
}

const Consent = () => {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [details, setDetails] = useState<ConsentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = new URLSearchParams(search).get('request')

  useEffect(() => {
    if (!request) {
      setError('This consent request is missing or expired.')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/oidc/consent?request=${encodeURIComponent(request)}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })

        if (res.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload.message ?? 'Could not load the consent request.')
        }

        const payload = await res.json()
        setDetails(payload as ConsentDetails)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate, request])

  const submit = async (approve: boolean) => {
    if (!request) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/oidc/consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request, approve }),
      })

      if (res.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.message ?? 'The consent request could not be completed.')
      }

      if (payload.redirect) {
        window.location.assign(payload.redirect)
        return
      }

      throw new Error('No redirect returned from the server.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-2xl">
        <div className={cardStyle}>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-xl font-bold text-slate-700">
              {details?.client.logoUri ? (
                <img src={details.client.logoUri} alt="" className="h-full w-full object-cover" />
              ) : (
                details?.client.name?.slice(0, 1).toUpperCase() ?? 'A'
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Authorize access</p>
              <h1 className="text-2xl font-semibold">{details?.client.name ?? 'Application'} wants to access your account</h1>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading request…</p>
          ) : error ? (
            <div className="space-y-4">
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                onClick={() => navigate('/login', { replace: true })}
              >
                Back to sign in
              </button>
            </div>
          ) : details ? (
            <div className="space-y-6">
              <p className="text-sm leading-6 text-slate-600">
                {details.client.description || 'This application is requesting permission to use your account information.'}
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-medium text-slate-700">This app will be able to:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {details.permissions.length > 0 ? (
                    details.permissions.map((permission) => <li key={permission}>{permission}</li>)
                  ) : (
                    <li>Access the public profile information associated with your account.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Signed in as</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{details.user.fullname}</p>
                <p className="text-sm text-slate-600">{details.user.email}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void submit(false)}
                  disabled={submitting}
                >
                  {submitting ? 'Processing…' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  onClick={() => void submit(true)}
                  disabled={submitting}
                >
                  {submitting ? 'Authorizing…' : 'Allow access'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default Consent
