import { NextRequest, NextResponse } from 'next/server'
import { getParty } from '@/lib/parties'
import { refreshAccessToken } from '@/lib/spotify'
import { updateParty } from '@/lib/parties'

export async function POST(request: NextRequest) {
  const { partyId } = await request.json()
  const party = getParty(partyId)
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  const data = await refreshAccessToken(party.refreshToken)
  if (!data.access_token) return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })

  updateParty(partyId, {
    hostToken: data.access_token,
    tokenExpiry: Date.now() + (data.expires_in - 60) * 1000
  })

  const response = NextResponse.json({ token: data.access_token })
  response.cookies.set('host_token', data.access_token, {
    httpOnly: false,
    maxAge: data.expires_in,
    path: '/',
    sameSite: 'strict'
  })
  return response
}
