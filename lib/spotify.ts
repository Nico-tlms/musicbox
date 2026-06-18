import { getParty, updateParty } from './parties'

const BASE = 'https://api.spotify.com/v1'

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function basicAuthHeader() {
  return {
    Authorization: `Basic ${Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64')}`
  }
}

export async function refreshAccessToken(token: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...basicAuthHeader()
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token })
  })
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function getValidToken(partyId: string): Promise<string | null> {
  const party = getParty(partyId)
  if (!party) return null

  if (Date.now() < party.tokenExpiry) return party.hostToken

  const data = await refreshAccessToken(party.refreshToken)
  if (!data.access_token) return null

  updateParty(partyId, {
    hostToken: data.access_token,
    tokenExpiry: Date.now() + (data.expires_in - 60) * 1000
  })
  return data.access_token
}

export async function searchTracks(token: string, query: string) {
  const res = await fetch(
    `${BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
    { headers: authHeader(token) }
  )
  return res.json()
}

export async function playTrack(token: string, deviceId: string, uri: string) {
  return fetch(`${BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri] })
  })
}

export async function pausePlayback(token: string, deviceId: string) {
  return fetch(`${BASE}/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: authHeader(token)
  })
}

export async function resumePlayback(token: string, deviceId: string) {
  return fetch(`${BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: authHeader(token)
  })
}

export function exchangeCode(code: string, redirectUri: string) {
  return fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...basicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  }).then(r => r.json()) as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    error?: string
  }>
}
