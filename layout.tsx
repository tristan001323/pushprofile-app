import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PushProfile - Matching intelligent CV-Jobs',
  description: 'Plateforme de matching intelligent entre CVs et opportunités',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
