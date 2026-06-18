'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'
import type { Track } from '@/lib/parties'

interface SearchTrack {
  id: string
  name: string
  artist: string
  album: string
  albumArt: string
  duration: number
  uri: string
}

export default function GuestPage() {
  const { partyId } = useParams<{ partyId: string }>()

  const [queue, setQueue] = useState<Track[]>([])
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [showNameModal, setShowNameModal] = useState(false)
  const [pendingTrack, setPendingTrack] = useState<SearchTrack | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [partyEnded, setPartyEnded] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(`mb-name-${partyId}`)
    if (saved) setGuestName(saved)
  }, [partyId])

  useEffect(() => {
    if (!partyId) return
    const socket = socketIO()
    socketRef.current = socket
    socket.emit('join-party', partyId)
    socket.on('queue-updated', (q: Track[]) => setQueue(q))
    socket.on('now-playing', (t: Track) => setCurrentTrack(t))
    socket.on('party-ended', () => setPartyEnded(true))

    fetch(`/api/party/${partyId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); return }
        setQueue(data.queue ?? [])
        setCurrentTrack(data.currentTrack)
      })

    return () => { socket.disconnect() }
  }, [partyId])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); return }
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&partyId=${partyId}`)
        const data = await res.json()
        setResults(data.tracks ?? [])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }

  const requestAdd = (track: SearchTrack) => {
    if (addedIds.has(track.id)) return
    if (!guestName) {
      setPendingTrack(track)
      setShowNameModal(true)
      setTimeout(() => nameInputRef.current?.focus(), 80)
    } else {
      addTrack(track, guestName)
    }
  }

  const addTrack = async (track: SearchTrack, name: string) => {
    setAddedIds(prev => new Set([...prev, track.id]))
    await fetch(`/api/party/${partyId}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...track, addedBy: name })
    })
  }

  const confirmName = (name: string) => {
    const n = name.trim() || 'Anonyme'
    setGuestName(n)
    localStorage.setItem(`mb-name-${partyId}`, n)
    setShowNameModal(false)
    if (pendingTrack) { addTrack(pendingTrack, n); setPendingTrack(null) }
  }

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (partyEnded || notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: '#0a0a0a', color: '#ffffff' }}>
        <div>
          <p className="text-5xl mb-4">{partyEnded ? '🎵' : '🔍'}</p>
          <h1 className="text-2xl font-bold mb-2">{partyEnded ? 'Soirée terminée' : 'Soirée introuvable'}</h1>
          <p style={{ color: '#b3b3b3' }} className="text-sm">
            {partyEnded ? "L'hôte a mis fin à la soirée. Merci !" : "Ce lien n'est pas valide ou la soirée est terminée."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: '#0a0a0a', color: '#ffffff' }}>
      {/* Name modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 border" style={{ background: '#141414', borderColor: '#282828' }}>
            <h2 className="font-bold text-lg mb-1">Ton prénom</h2>
            <p className="text-sm mb-4" style={{ color: '#b3b3b3' }}>Affiché à côté de tes propositions</p>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Ex : Sophie"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmName(guestName)}
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl border outline-none text-sm mb-3"
              style={{ background: '#0a0a0a', color: '#ffffff', borderColor: '#282828' }}
            />
            <div className="flex gap-3">
              <button onClick={() => confirmName('Anonyme')} className="flex-1 text-sm font-medium py-3 rounded-xl transition-all active:scale-95" style={{ background: '#282828', color: '#b3b3b3' }}>
                Anonyme
              </button>
              <button onClick={() => confirmName(guestName)} className="flex-1 text-sm font-bold py-3 rounded-xl transition-all active:scale-95" style={{ background: '#1DB954', color: '#000' }}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderColor: '#282828' }}>
        <span className="text-lg font-black" style={{ color: '#1DB954' }}>MusicBox</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(29,185,84,0.15)', color: '#1DB954' }}>
          #{partyId}
        </span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Now playing */}
        {currentTrack && (
          <div className="rounded-2xl p-4 border" style={{ background: '#141414', borderColor: '#282828' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#b3b3b3' }}>En cours</p>
            <div className="flex items-center gap-3">
              {currentTrack.albumArt && (
                <img src={currentTrack.albumArt} alt="" className="w-14 h-14 rounded-lg flex-shrink-0 shadow-md" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{currentTrack.name}</p>
                <p className="text-sm truncate" style={{ color: '#b3b3b3' }}>{currentTrack.artist}</p>
              </div>
              <span className="text-xl flex-shrink-0 animate-pulse" style={{ color: '#1DB954' }}>♪</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#141414', borderColor: '#282828' }}>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#b3b3b3' }}>Proposer un morceau</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#535353' }}>🔍</span>
              <input
                type="search"
                placeholder="Artiste, titre..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-xl border outline-none text-sm transition-colors"
                style={{ background: '#0a0a0a', color: '#ffffff', borderColor: '#282828' }}
              />
            </div>
          </div>

          {isSearching && (
            <p className="text-sm text-center py-5" style={{ color: '#b3b3b3' }}>Recherche...</p>
          )}

          {results.length > 0 && (
            <ul>
              {results.map(track => (
                <li key={track.id} className="flex items-center gap-3 px-4 py-3 border-t transition-colors" style={{ borderColor: '#282828' }}>
                  {track.albumArt && <img src={track.albumArt} alt="" className="w-11 h-11 rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                    <p className="text-xs truncate" style={{ color: '#535353' }}>{track.album} · {fmt(track.duration)}</p>
                  </div>
                  <button
                    onClick={() => requestAdd(track)}
                    disabled={addedIds.has(track.id)}
                    className="flex-shrink-0 text-sm font-bold w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:cursor-not-allowed"
                    style={addedIds.has(track.id)
                      ? { background: '#282828', color: '#535353' }
                      : { background: '#1DB954', color: '#000' }
                    }
                  >
                    {addedIds.has(track.id) ? '✓' : '+'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="rounded-2xl p-4 border" style={{ background: '#141414', borderColor: '#282828' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#b3b3b3' }}>
              File d'attente ({queue.length})
            </p>
            <ul className="space-y-3">
              {queue.map((track, i) => (
                <li key={`${track.id}-${i}`} className="flex items-center gap-3">
                  <span className="text-xs w-4 flex-shrink-0" style={{ color: '#535353' }}>{i + 1}</span>
                  {track.albumArt && <img src={track.albumArt} alt="" className="w-9 h-9 rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{track.name}</p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                    {track.addedBy && <p className="text-xs" style={{ color: '#1DB954' }}>par {track.addedBy}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!currentTrack && queue.length === 0 && !results.length && (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-semibold text-lg">C'est la soirée !</p>
            <p className="text-sm mt-1" style={{ color: '#b3b3b3' }}>Sois le premier à proposer un morceau</p>
          </div>
        )}
      </main>
    </div>
  )
}
