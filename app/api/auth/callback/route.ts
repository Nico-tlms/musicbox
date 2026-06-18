import { NextRequest, NextResponse } from 'next/server'
import { createParty } from '@/lib/parties'
import { exchangeCode } from '@/lib/spotify'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const base = process.env.NEXT_PUBLIC_BASE_URL!

  if (error || !code) {
    return NextResponse.redirect(`${base}/?error=auth_denied`)
  }

  const data = await exchangeCode(code, `${base}/api/auth/callback`)

  if (!data.access_token) {
    return NextResponse.redirect(`${base}/?error=auth_failed`)
  }

  const partyId = createParty(data.access_token, data.refresh_token, data.expires_in)

  const response = NextResponse.redirect(`${base}/host?party=${partyId}`)

  // Readable by JS for the Spotify Web Playback SDK
  response.cookies.set('host_token', data.access_token, {
    httpOnly: false,
    maxAge: data.expires_in,
    path: '/',
    sameSite: 'strict'
  })
  response.cookies.set('party_id', partyId, {
    httpOnly: false,
    maxAge: 86400,
    path: '/',
    sameSite: 'strict'
  })

  return response
}
