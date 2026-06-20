import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Z One — Ekosistem Digital',
  description: 'Satu platform, semua aplikasi bisnis Anda',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-950 text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
