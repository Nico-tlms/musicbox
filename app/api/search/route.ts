import { NextRequest, NextResponse } from 'next/server'
import { getValidToken, searchTracks } from '@/lib/spotify'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const partyId = request.nextUrl.searchParams.get('partyId')

  if (!q || !partyId) {
    return NextResponse.json({ error: 'Missing q or partyId' }, { status: 400 })
  }

  const token = await getValidToken(partyId)
  if (!token) return NextResponse.json({ error: 'No valid token' }, { status: 401 })

  const data = await searchTracks(token, q)

  const tracks = (data.tracks?.items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    album: item.album.name,
    albumArt: item.album.images[1]?.url || item.album.images[0]?.url || '',
    duration: item.duration_ms,
    uri: item.uri
  }))

  return NextResponse.json({ tracks })
}
