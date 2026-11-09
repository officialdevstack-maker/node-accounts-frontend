import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clientIdFromSearch } from '../src/lib/useClientInfo'

test('extracts a client id from an absolute authorize return URL', () => {
  const search = `?return_to=${encodeURIComponent('https://accounts.example/api/oidc/authorize?client_id=spurs-app')}`
  assert.equal(clientIdFromSearch(search), 'spurs-app')
})

test('extracts a client id from a relative authorize return URL', () => {
  const search = `?return_to=${encodeURIComponent('/api/oidc/authorize?client_id=spurs-app')}`
  assert.equal(clientIdFromSearch(search, 'https://accounts.example'), 'spurs-app')
})

test('does not request client info when return_to is not an authorize URL', () => {
  const search = `?return_to=${encodeURIComponent('/dashboard?client_id=spurs-app')}`
  assert.equal(clientIdFromSearch(search), null)
})
