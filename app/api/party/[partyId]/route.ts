import { NextRequest, NextResponse } from 'next/server'
import { getParty, deleteParty, emitToParty } from '@/lib/parties'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  const party = getParty(partyId)
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  return NextResponse.json({
    id: party.id,
    queue: party.queue,
    currentTrack: party.currentTrack,
    isPlaying: party.isPlaying
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  emitToParty(partyId, 'party-ended', {})
  deleteParty(partyId)
  return NextResponse.json({ ok: true })
}
