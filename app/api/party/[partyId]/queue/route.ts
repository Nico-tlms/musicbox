import { NextRequest, NextResponse } from 'next/server'
import { getParty, addToQueue, removeFromQueue, emitToParty } from '@/lib/parties'
import type { Track } from '@/lib/parties'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  if (!getParty(partyId)) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  const track: Track = await request.json()
  const queue = addToQueue(partyId, track)
  emitToParty(partyId, 'queue-updated', queue)

  return NextResponse.json({ queue })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  const { trackId } = await request.json()
  const queue = removeFromQueue(partyId, trackId)
  emitToParty(partyId, 'queue-updated', queue)
  return NextResponse.json({ queue })
}
