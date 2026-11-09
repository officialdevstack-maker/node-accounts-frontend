import { useEffect, useState } from 'react'

type ClientInfo = {
  name: string
  logoUri: string | null
}

function clientIdFromSearch(search: string): string | null {
  const returnTo = new URLSearchParams(search).get('return_to')
  if (!returnTo) return null

  try {
    const authorizeUrl = new URL(returnTo, window.location.origin)
    if (!authorizeUrl.pathname.endsWith('/authorize')) return null
    return authorizeUrl.searchParams.get('client_id')?.trim() || null
  } catch {
    return null
  }
}

export function useClientInfo(search: string): ClientInfo {
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ name: 'Spurs', logoUri: null })

  useEffect(() => {
    const clientId = clientIdFromSearch(search)
    setClientInfo({ name: 'Spurs', logoUri: null })
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
          setClientInfo({
            name: data.name,
            logoUri: 'logoUri' in data && typeof data.logoUri === 'string' ? data.logoUri : null,
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

  return clientInfo
}
