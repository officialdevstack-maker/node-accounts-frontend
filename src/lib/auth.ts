import type { NavigateFunction } from 'react-router-dom'

/** Where to send the user once auth is done: ?redirect_uri=... or the profile. */
export const getRedirectTarget = (search: string, fallback = '/profile') => {
  const param = new URLSearchParams(search).get('redirect_uri')
  return param && param !== 'null' ? param : fallback
}

/** Full URLs leave the app, in-app paths use the router. */
export const followRedirect = (target: string, navigate: NavigateFunction) => {
  if (target.startsWith('http')) {
    window.location.assign(target)
    return
  }
  navigate(target, { replace: true })
}

/** Emails a 6-digit code to the currently signed-in user. */
export const requestVerificationCode = async () => {
  const res = await fetch('/api/auth/verify-email', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.message ?? 'Could not send a verification code.')
  }
}
