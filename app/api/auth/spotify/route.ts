import { NextResponse } from 'next/server'

export async function GET() {
  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ].join(' ')

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
    scope: scopes,
    show_dialog: 'true'
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}
