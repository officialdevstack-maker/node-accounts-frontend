import { useEffect, useState } from 'react'

type ClientInfo = {
  name: string
  logoUri: string | null
}

export function clientIdFromSearch(search: string, origin = 'http://localhost'): string | null {
  const returnTo = new URLSearchParams(search).get('return_to')
  if (!returnTo) return null

  try {
    const authorizeUrl = new URL(returnTo, origin)
    if (!authorizeUrl.pathname.endsWith('/authorize')) return null
    return authorizeUrl.searchParams.get('client_id')?.trim() || null
  } catch {
    return null
  }
}

export function useClientInfo(search: string): ClientInfo {
  const [loadedClient, setLoadedClient] = useState<{ search: string; info: ClientInfo } | null>(null)

  useEffect(() => {
    const clientId = clientIdFromSearch(search, window.location.origin)
    if (!clientId) return

    const controller = new AbortController()
    let active = true

    const loadClientInfo = async () => {
      try {
        const response = await fetch(
          `/api/oidc/client-info?client_id=${encodeURIComponent(clientId)}`,
          { signal: controller.signal },
        )
        if (!response.ok) return

        const data: unknown = await response.json()
        if (
          active &&
          typeof data === 'object' &&
          data !== null &&
          'name' in data &&
          typeof data.name === 'string' &&
          data.name.trim()
        ) {
          setLoadedClient({
            search,
            info: {
              name: data.name,
              logoUri: 'logoUri' in data && typeof data.logoUri === 'string' ? data.logoUri : null,
            },
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Unable to load the OIDC client name.', error)
        }
      }
    }

    void loadClientInfo()
    return () => {
      active = false
      controller.abort()
    }
  }, [search])

  return loadedClient?.search === search ? loadedClient.info : { name: 'Spurs', logoUri: null }
}
