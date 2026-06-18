'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [link, setLink] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [error, setError] = useState('')

  const joinParty = () => {
    const trimmed = link.trim()
    if (!trimmed) return

    // Accept either a full URL or just the party ID
    const match = trimmed.match(/\/party\/([A-Z0-9]{4,8})/i) || trimmed.match(/^([A-Z0-9]{4,8})$/i)
    if (match) {
      router.push(`/party/${match[1].toUpperCase()}`)
    } else {
      setError('Lien invalide. Demande le QR code ou le lien à l\'hôte.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0a0a0a' }}>
      {/* Logo */}
      <div className="mb-14 text-center select-none">
        <h1 className="text-6xl font-black tracking-tight mb-3">
          <span style={{ color: '#1DB954' }}>Music</span>
          <span style={{ color: '#ffffff' }}>Box</span>
        </h1>
        <p style={{ color: '#b3b3b3' }} className="text-lg">Tout le monde est DJ 🎵</p>
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-4">
        <a
          href="/api/auth/spotify"
          className="block w-full text-center font-bold text-lg py-4 px-6 rounded-2xl transition-all active:scale-95"
          style={{ background: '#1DB954', color: '#000000' }}
        >
          🎵 Je suis l'hôte
        </a>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: '#282828' }} />
          <span style={{ color: '#535353' }} className="text-sm">ou</span>
          <div className="flex-1 h-px" style={{ background: '#282828' }} />
        </div>

        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="block w-full text-center font-semibold text-base py-4 px-6 rounded-2xl border transition-all active:scale-95"
            style={{ background: 'transparent', color: '#ffffff', borderColor: '#282828' }}
          >
            🎉 J'ai une invitation
          </button>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Colle le lien ou le code"
              value={link}
              onChange={e => { setLink(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && joinParty()}
              className="w-full px-4 py-3.5 rounded-xl border outline-none text-sm transition-colors"
              style={{
                background: '#141414',
                color: '#ffffff',
                borderColor: error ? '#ef4444' : '#282828',
                caretColor: '#1DB954'
              }}
            />
            {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
            <button
              onClick={joinParty}
              className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-95"
              style={{ background: '#282828', color: '#ffffff' }}
            >
              Rejoindre la soirée →
            </button>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-16 text-center space-y-1.5" style={{ color: '#535353' }}>
        <p className="text-xs">✓ Spotify Premium requis pour l'hôte</p>
        <p className="text-xs">✓ Aucun compte requis pour les invités</p>
      </div>
    </div>
  )
}
