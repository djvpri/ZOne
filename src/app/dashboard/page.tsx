'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { InstallPrompt } from '../pwa-register'

type App = {
  id: string; slug: string; name: string; description: string | null
  icon: string; url: string; color: string; category: string; order: number
}

type UserApp = { app: App; active: boolean }

// App yang sudah punya endpoint /sso di sisinya -> dibuka lewat handoff token,
// supaya user tidak perlu login ulang manual. App lain tetap link langsung seperti biasa.
const SSO_ENABLED_SLUGS = new Set(['zface'])

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  pos: { label: 'Point of Sale', icon: '🏪' },
  hr: { label: 'Human Resources', icon: '👥' },
  booking: { label: 'Booking & Reservasi', icon: '📅' },
  finance: { label: 'Keuangan & Investasi', icon: '💰' },
  identity: { label: 'Identitas & Keamanan', icon: '🔐' },
  analytics: { label: 'Analytics & BI', icon: '📊' },
  health: { label: 'Kesehatan', icon: '🏥' },
  platform: { label: 'Platform', icon: '🚀' },
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [apps, setApps] = useState<UserApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch('/api/apps').then(r => r.json()).then(setApps).finally(() => setLoading(false))
    }
  }, [session])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return null

  const user = session.user as any
  const grouped: Record<string, UserApp[]> = {}
  apps.forEach(ua => {
    const cat = ua.app.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(ua)
  })

  return (
    <div className="min-h-[100dvh] pb-20">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 pt-safe">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">Z</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Z One</h1>
              <p className="text-[11px] text-slate-400">Ekosistem Digital</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/profile" className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-lg" title="Profil">
              👤
            </a>
            {user.role === 'ADMIN' && (
              <a href="/manage" className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-lg" title="Admin">
                ⚙️
              </a>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-lg">
              🚪
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Halo, {user.name?.split(' ')[0]} 👋</h2>
          <p className="text-slate-400 text-sm">{apps.filter(a => a.app.url !== '#').length} aplikasi aktif</p>
        </div>

        {/* User info card - mobile */}
        <div className="sm:hidden bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-400"></div>
            </div>
          </div>
        </div>

        {/* Apps by category */}
        {Object.entries(grouped).map(([cat, items]) => {
          const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: '📦' }
          return (
            <div key={cat} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{catInfo.icon}</span>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{catInfo.label}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(ua => {
                  const ssoEnabled = SSO_ENABLED_SLUGS.has(ua.app.slug) && ua.app.url !== '#'
                  const href = ssoEnabled ? `/api/sso/${ua.app.slug}` : (ua.app.url !== '#' ? ua.app.url : '#')
                  return (
                  <a key={ua.app.id} href={href}
                    target={ua.app.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={`group block bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all active:scale-[0.98] ${ua.app.url !== '#' ? 'hover:border-slate-600 hover:bg-slate-800/50' : 'opacity-50 cursor-not-allowed'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ backgroundColor: ua.app.color + '20' }}>
                        {ua.app.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{ua.app.name}</span>
                          {ua.app.url === '#' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">Soon</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ua.app.description}</p>
                      </div>
                      {ua.app.url !== '#' && (
                        <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
                      )}
                    </div>
                  </a>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Quick stats - desktop only */}
        <div className="hidden sm:grid grid-cols-4 gap-3 mt-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Aplikasi Aktif</div>
            <div className="text-2xl font-bold text-blue-400">{apps.filter(a => a.app.url !== '#').length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Total Apps</div>
            <div className="text-2xl font-bold text-purple-400">{apps.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400"></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Role</div>
            <div className="text-2xl font-bold text-amber-400">{user.role}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-600 pb-4">
          Z One Platform · 2026
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-30 pb-safe">
        <div className="flex items-center justify-around py-2">
          <a href="/dashboard" className="flex flex-col items-center gap-1 px-4 py-1 text-blue-400">
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-medium">Beranda</span>
          </a>
          <a href="/profile" className="flex flex-col items-center gap-1 px-4 py-1 text-slate-400">
            <span className="text-xl">👤</span>
            <span className="text-[10px] font-medium">Profil</span>
          </a>
          {user.role === 'ADMIN' && (
            <a href="/manage" className="flex flex-col items-center gap-1 px-4 py-1 text-slate-400">
              <span className="text-xl">⚙️</span>
              <span className="text-[10px] font-medium">Admin</span>
            </a>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex flex-col items-center gap-1 px-4 py-1 text-slate-400">
            <span className="text-xl">🚪</span>
            <span className="text-[10px] font-medium">Keluar</span>
          </button>
        </div>
      </nav>

      <InstallPrompt />
    </div>
  )
}
