// src/pages/NotFound.tsx
import { Link, useNavigate } from 'react-router-dom'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-primary px-6 text-center">
      {/* Soft glow behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-3xl"
      />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-4">
        <p className="bg-gradient-to-b from-blue-600 to-blue-600/20 bg-clip-text text-8xl font-bold leading-none text-transparent sm:text-9xl">
          404
        </p>

        <h1 className="text-2xl font-semibold">We can't find that page</h1>

        <p className="text-sm leading-relaxed text-gray-500">
          The link may be broken or the page may have moved. Check the address
          or head back to sign in.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Go back
          </button>

          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}

export default NotFound