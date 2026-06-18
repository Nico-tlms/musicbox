import { NextRequest, NextResponse } from 'next/server'
import { updateParty } from '@/lib/parties'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  const { deviceId } = await request.json()
  updateParty(partyId, { deviceId })
  return NextResponse.json({ ok: true })
}
