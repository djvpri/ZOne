import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { Providers } from './providers'
import { PWARegister } from './pwa-register'

export const metadata: Metadata = {
  title: 'Z One — Ekosistem Digital',
  description: 'Satu platform, semua aplikasi bisnis Anda',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Z One',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Z One" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="bg-slate-950 text-white min-h-[100dvh] overscroll-none">
        <PWARegister />
        <Providers>
          <div className="min-h-[100dvh] pb-safe">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
