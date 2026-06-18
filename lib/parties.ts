export interface Track {
  id: string
  name: string
  artist: string
  album: string
  albumArt: string
  duration: number
  uri: string
  addedBy?: string
}

export interface Party {
  id: string
  hostToken: string
  refreshToken: string
  tokenExpiry: number
  queue: Track[]
  currentTrack: Track | null
  deviceId: string | null
  isPlaying: boolean
  createdAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __parties: Map<string, Party> | undefined
  // eslint-disable-next-line no-var
  var __io: any
}

if (!global.__parties) {
  global.__parties = new Map<string, Party>()
}

const parties = global.__parties!

export function createParty(hostToken: string, refreshToken: string, expiresIn: number): string {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase()
  parties.set(id, {
    id,
    hostToken,
    refreshToken,
    tokenExpiry: Date.now() + (expiresIn - 60) * 1000,
    queue: [],
    currentTrack: null,
    deviceId: null,
    isPlaying: false,
    createdAt: Date.now()
  })
  return id
}

export function getParty(id: string): Party | undefined {
  return parties.get(id)
}

export function updateParty(id: string, updates: Partial<Party>): void {
  const party = parties.get(id)
  if (party) parties.set(id, { ...party, ...updates })
}

export function addToQueue(partyId: string, track: Track): Track[] {
  const party = parties.get(partyId)
  if (!party) throw new Error('Party not found')
  party.queue.push(track)
  return [...party.queue]
}

export function removeFromQueue(partyId: string, trackId: string): Track[] {
  const party = parties.get(partyId)
  if (!party) throw new Error('Party not found')
  party.queue = party.queue.filter(t => t.id !== trackId)
  return [...party.queue]
}

export function dequeueNext(partyId: string): Track | null {
  const party = parties.get(partyId)
  if (!party || party.queue.length === 0) return null
  const next = party.queue.shift()!
  party.currentTrack = next
  party.isPlaying = true
  return next
}

export function deleteParty(id: string): void {
  parties.delete(id)
}

export function emitToParty(partyId: string, event: string, data: unknown): void {
  if (global.__io) {
    global.__io.to(partyId).emit(event, data)
  }
}
