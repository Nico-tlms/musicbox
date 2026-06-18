'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { io as socketIO, Socket } from 'socket.io-client'
import QRCode from 'qrcode'
import type { Track } from '@/lib/parties'

declare global {
  interface Window {
    Spotify: { Player: new (opts: any) => any }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}

function HostDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [partyId, setPartyId] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const [sdkError, setSdkError] = useState('')
  const [currentTrack, setCurrentTrack] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState<Track[]>([])
  const [qrCode, setQrCode] = useState('')
  const [partyUrl, setPartyUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const deviceIdRef = useRef('')
  const prevStateRef = useRef({ paused: true, position: 0 })
  const playerRef = useRef<any>(null)
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef('')
  const partyIdRef = useRef<string | null>(null)

  // Resolve partyId from URL param or cookie
  useEffect(() => {
    const fromUrl = searchParams.get('party')
    const fromCookie = getCookie('party_id')
    const id = fromUrl || fromCookie
    if (!id) {
      router.push('/')
      return
    }
    setPartyId(id)
    partyIdRef.current = id
  }, [searchParams, router])

  // Read token from cookie
  useEffect(() => {
    const t = getCookie('host_token')
    if (!t) {
      router.push('/api/auth/spotify')
      return
    }
    setToken(t)
    tokenRef.current = t
  }, [router])

  // Socket.io + initial state
  useEffect(() => {
    if (!partyId) return
    const socket = socketIO()
    socketRef.current = socket
    socket.emit('join-party', partyId)
    socket.on('queue-updated', (q: Track[]) => setQueue(q))
    socket.on('now-playing', (t: Track) => setCurrentTrack(t))

    fetch(`/api/party/${partyId}`)
      .then(r => r.json())
      .then(data => {
        setQueue(data.queue ?? [])
        if (data.currentTrack) setCurrentTrack(data.currentTrack)
      })

    return () => { socket.disconnect() }
  }, [partyId])

  // QR code
  useEffect(() => {
    if (!partyId) return
    const url = `${window.location.origin}/party/${partyId}`
    setPartyUrl(url)
    QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrCode)
      .catch(console.error)
  }, [partyId])

  // Auto token refresh every 50 min
  useEffect(() => {
    if (!partyId || !token) return
    const id = setInterval(async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId })
      })
      const data = await res.json()
      if (data.token) { setToken(data.token); tokenRef.current = data.token }
    }, 50 * 60 * 1000)
    return () => clearInterval(id)
  }, [partyId, token])

  const playNext = useCallback(async () => {
    const id = partyIdRef.current
    if (!id) return
    await fetch(`/api/party/${id}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceIdRef.current })
    })
  }, [])

  // Spotify Web Playback SDK — loads as soon as token is available
  useEffect(() => {
    if (!token) return

    const init = () => {
      const player = new window.Spotify.Player({
        name: 'MusicBox 🎵',
        getOAuthToken: (cb: (t: string) => void) => cb(tokenRef.current),
        volume: 0.8
      })

      player.addListener('ready', async ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id
        setSdkReady(true)
        setSdkError('')
        const id = partyIdRef.current
        if (id) {
          await fetch(`/api/party/${id}/device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: device_id })
          })
        }
      })

      player.addListener('not_ready', () => setSdkReady(false))

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        setSdkError(`Erreur d'initialisation : ${message}`)
      })

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        setSdkError(`Erreur d'authentification Spotify : ${message}`)
      })

      player.addListener('account_error', ({ message }: { message: string }) => {
        setSdkError(`Compte Spotify insuffisant (Premium requis) : ${message}`)
      })

      player.addListener('player_state_changed', (state: any) => {
        if (!state) return
        const { paused, position } = state
        if (!prevStateRef.current.paused && paused && position === 0) {
          playNext()
        }
        prevStateRef.current = { paused, position }
        setIsPlaying(!paused)
        setCurrentTrack(state.track_window.current_track)
      })

      player.connect().then((success: boolean) => {
        if (!success) setSdkError('Impossible de connecter le lecteur Spotify.')
      })

      playerRef.current = player
    }

    if (window.Spotify) {
      init()
    } else {
      window.onSpotifyWebPlaybackSDKReady = init
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.onerror = () => setSdkError('Impossible de charger le SDK Spotify.')
      document.body.appendChild(script)
    }

    return () => { playerRef.current?.disconnect() }
  }, [token, playNext])

  const togglePlay = async () => {
    if (!playerRef.current) return
    if (isPlaying) { await playerRef.current.pause() }
    else { await playerRef.current.resume() }
  }

  const removeFromQueue = async (trackId: string) => {
    if (!partyId) return
    await fetch(`/api/party/${partyId}/queue`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId })
    })
  }

  const endParty = async () => {
    if (!partyId) return
    if (!confirm('Terminer la soirée ? Les invités seront déconnectés.')) return
    await fetch(`/api/party/${partyId}`, { method: 'DELETE' })
    router.push('/')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(partyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text
      const el = document.getElementById('party-url-text')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: '#0a0a0a', color: '#ffffff' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderColor: '#282828' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black" style={{ color: '#1DB954' }}>MusicBox</span>
          {partyId && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(29,185,84,0.15)', color: '#1DB954' }}>
              #{partyId}
            </span>
          )}
        </div>
        <button onClick={endParty} className="text-sm px-3 py-1.5 rounded-lg border transition-colors" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
          Terminer
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* SDK status */}
        {sdkError ? (
          <div className="text-sm px-4 py-3 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
            {sdkError}
          </div>
        ) : !sdkReady && (
          <div className="text-sm px-4 py-3 rounded-xl border flex items-center gap-2" style={{ background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.25)', color: '#eab308' }}>
            <span className="animate-spin">⟳</span>
            Connexion au lecteur Spotify...
          </div>
        )}

        {/* Share card */}
        <div className="rounded-2xl p-5 border" style={{ background: '#141414', borderColor: '#282828' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#b3b3b3' }}>Inviter des amis</p>
          {partyId ? (
            <div className="flex gap-4 items-center">
              {qrCode && (
                <div className="rounded-xl overflow-hidden flex-shrink-0 shadow-lg" style={{ background: '#ffffff', padding: '8px' }}>
                  <img src={qrCode} alt="QR Code" className="w-[100px] h-[100px]" />
                </div>
              )}
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-xs" style={{ color: '#b3b3b3' }}>Scanne le QR code ou partage le lien</p>
                <p id="party-url-text" className="text-xs font-mono break-all px-2 py-1.5 rounded-lg select-all cursor-text" style={{ background: '#0a0a0a', color: '#b3b3b3' }}>
                  {partyUrl || '...'}
                </p>
                <button onClick={copyLink} className="w-full text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95" style={{ background: '#1DB954', color: '#000000' }}>
                  {copied ? '✓ Copié !' : 'Copier le lien'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#b3b3b3' }}>Chargement de la soirée...</p>
          )}
        </div>

        {/* Now playing */}
        <div className="rounded-2xl p-5 border" style={{ background: '#141414', borderColor: '#282828' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#b3b3b3' }}>En cours</p>
          {currentTrack ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {currentTrack.album?.images?.[0]?.url && (
                  <img src={currentTrack.album.images[0].url} alt="" className="w-16 h-16 rounded-lg flex-shrink-0 shadow-lg" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{currentTrack.name}</p>
                  <p className="text-sm truncate" style={{ color: '#b3b3b3' }}>
                    {currentTrack.artists?.map((a: any) => a.name).join(', ')}
                  </p>
                  <p className="text-xs truncate" style={{ color: '#535353' }}>{currentTrack.album?.name}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-5">
                <button onClick={togglePlay} disabled={!sdkReady} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all active:scale-90 disabled:opacity-40 shadow-lg" style={{ background: '#1DB954', color: '#000' }}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button onClick={playNext} disabled={!sdkReady || queue.length === 0} className="w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all active:scale-90 disabled:opacity-40" style={{ background: '#282828', color: '#ffffff' }}>
                  ⏭
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">🎵</p>
              <p className="text-sm mb-4" style={{ color: '#b3b3b3' }}>Aucune musique en cours</p>
              {queue.length > 0 && sdkReady && (
                <button onClick={playNext} className="text-sm font-bold px-6 py-3 rounded-xl transition-all active:scale-95" style={{ background: '#1DB954', color: '#000' }}>
                  Lancer la file d'attente
                </button>
              )}
            </div>
          )}
        </div>

        {/* Queue */}
        <div className="rounded-2xl p-5 border" style={{ background: '#141414', borderColor: '#282828' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#b3b3b3' }}>
            File d'attente {queue.length > 0 && `(${queue.length})`}
          </p>
          {queue.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#b3b3b3' }}>
              Vide — les invités peuvent proposer des morceaux !
            </p>
          ) : (
            <ul className="space-y-3">
              {queue.map((track, i) => (
                <li key={`${track.id}-${i}`} className="flex items-center gap-3">
                  <span className="text-xs w-4 flex-shrink-0 text-right" style={{ color: '#535353' }}>{i + 1}</span>
                  {track.albumArt && <img src={track.albumArt} alt="" className="w-10 h-10 rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                    {track.addedBy && <p className="text-xs" style={{ color: '#1DB954' }}>par {track.addedBy}</p>}
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#535353' }}>{fmt(track.duration)}</span>
                  <button onClick={() => removeFromQueue(track.id)} className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-colors" style={{ color: '#535353' }}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default function HostPage() {
  return (
    <Suspense>
      <HostDashboard />
    </Suspense>
  )
}
