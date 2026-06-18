import { NextRequest, NextResponse } from 'next/server'
import { getParty, dequeueNext, emitToParty } from '@/lib/parties'
import { getValidToken, playTrack, pausePlayback, resumePlayback } from '@/lib/spotify'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  const { action, deviceId: bodyDeviceId } = await request.json()

  const party = getParty(partyId)
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  const token = await getValidToken(partyId)
  if (!token) return NextResponse.json({ error: 'No valid token' }, { status: 401 })

  const deviceId = bodyDeviceId || party.deviceId
  if (!deviceId) return NextResponse.json({ error: 'No device connected' }, { status: 400 })

  if (action === 'pause') {
    await pausePlayback(token, deviceId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'resume') {
    await resumePlayback(token, deviceId)
    return NextResponse.json({ ok: true })
  }

  // Default: play next track in queue
  const track = dequeueNext(partyId)
  if (!track) return NextResponse.json({ error: 'Queue is empty' }, { status: 404 })

  await playTrack(token, deviceId, track.uri)

  const updatedParty = getParty(partyId)
  emitToParty(partyId, 'now-playing', track)
  emitToParty(partyId, 'queue-updated', updatedParty?.queue ?? [])

  return NextResponse.json({ track })
}
