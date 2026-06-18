import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MusicBox — La musique de votre soirée',
  description: 'Partagez la musique en soirée, tout le monde est DJ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
