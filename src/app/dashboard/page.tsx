'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type App = {
  id: string; slug: string; name: string; description: string | null
  icon: string; url: string; color: string; category: string; order: number
}

type UserApp = { app: App; active: boolean }

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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">Z</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Z One</h1>
              <p className="text-xs text-slate-400">Ekosistem Digital</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-slate-400">{user.role} · {user.plan || 'FREE'}</div>
            </div>
            <a href="/profile" className="text-slate-400 hover:text-blue-400 transition-colors p-2" title="Profil">
              👤
            </a>
            {user.role === 'ADMIN' && (
              <a href="/admin" className="text-slate-400 hover:text-amber-400 transition-colors p-2" title="Admin">
                ⚙️
              </a>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-slate-400 hover:text-red-400 transition-colors p-2">
              🚪
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Halo, {user.name?.split(' ')[0]} 👋</h2>
          <p className="text-slate-400 text-sm">Akses {apps.length} aplikasi dari satu tempat</p>
        </div>

        {/* Apps by category */}
        {Object.entries(grouped).map(([cat, items]) => {
          const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: '📦' }
          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{catInfo.icon}</span>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{catInfo.label}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(ua => (
                  <a key={ua.app.id} href={ua.app.url !== '#' ? ua.app.url : '#'}
                    target={ua.app.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={`group block bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-600 hover:bg-slate-800/50 ${ua.app.url === '#' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: ua.app.color + '20' }}>
                        {ua.app.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{ua.app.name}</span>
                          {ua.app.url === '#' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">Soon</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{ua.app.description}</p>
                      </div>
                      {ua.app.url !== '#' && (
                        <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-sm">→</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        })}

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Aplikasi Aktif</div>
            <div className="text-2xl font-bold text-blue-400">{apps.filter(a => a.app.url !== '#').length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Total Apps</div>
            <div className="text-2xl font-bold text-purple-400">{apps.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Plan</div>
            <div className="text-2xl font-bold text-green-400">{user.plan || 'FREE'}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">Role</div>
            <div className="text-2xl font-bold text-amber-400">{user.role}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-600">
          Z One Platform · Ekosistem Digital Terintegrasi · 2026
        </div>
      </main>
    </div>
  )
}
