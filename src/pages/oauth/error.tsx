import { Link, useLocation } from 'react-router-dom'

const OAuthError = () => {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const code = params.get('error') ?? 'error'
  const description = params.get('error_description') ?? 'Something went wrong.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Authorization error</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{code}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-6 flex gap-3">
          <Link
            to="/login"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Back to sign in
          </Link>
          <Link
            to="/profile"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            My profile
          </Link>
        </div>
      </div>
    </div>
  )
}

export default OAuthError
