'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import { InstallPrompt } from '../pwa-register'

type App = {
  id: string; slug: string; name: string; description: string | null
  icon: string; url: string; color: string; category: string; order: number
}

type UserApp = { app: App; active: boolean }

const SSO_ENABLED_SLUGS = new Set(['zface', 'zpos', 'zresto', 'zlaundry', 'zgold', 'zbengkel', 'zmedics', 'zabsen', 'zrooms', 'z-rooms'])

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

  // QR Scanner state
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [qrInput, setQrInput] = useState('')
  const [qrScanStatus, setQrScanStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [qrMsg, setQrMsg] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  const stopScanCamera = useCallback(() => {
    if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraActive(false)
  }, [])

  const closeQrScanner = useCallback(() => {
    stopScanCamera(); setShowQrScanner(false); setQrInput(''); setQrScanStatus('idle'); setQrMsg('')
  }, [stopScanCamera])

  // Parse token dari URL QR
  const extractToken = (raw: string) => {
    try {
      const url = new URL(raw)
      return url.searchParams.get('token') || raw
    } catch { return raw.trim() }
  }

  const approveQrToken = useCallback(async (token: string) => {
    setQrScanStatus('loading'); setQrMsg('')
    try {
      const res = await fetch('/api/qr/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'scan' }),
      })
      const d = await res.json()
      if (!res.ok) { setQrScanStatus('error'); setQrMsg(d.error || 'QR tidak valid'); return }
      setQrScanStatus('idle'); setQrMsg(`Login sebagai ${d.user?.name} — konfirmasi?`)
      const res2 = await fetch('/api/qr/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'approve' }),
      })
      if (res2.ok) { setQrScanStatus('success'); setQrMsg('✅ Login berhasil! Komputer sudah bisa masuk.') }
      else { setQrScanStatus('error'); setQrMsg('Gagal approve QR') }
    } catch { setQrScanStatus('error'); setQrMsg('Gagal menghubungi server') }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // kamera belakang
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraActive(true)
      }

      // Load jsQR dinamis
      const jsQR = (await import('jsqr')).default

      const scanFrame = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          scanLoopRef.current = requestAnimationFrame(scanFrame)
          return
        }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          // QR ditemukan!
          stopScanCamera()
          const token = extractToken(code.data)
          approveQrToken(token)
        } else {
          scanLoopRef.current = requestAnimationFrame(scanFrame)
        }
      }
      scanLoopRef.current = requestAnimationFrame(scanFrame)
    } catch (err: any) {
      setQrMsg('Kamera tidak bisa diakses. Pastikan izin kamera diberikan.')
      setQrScanStatus('error')
    }
  }, [stopScanCamera, approveQrToken])

  useEffect(() => {
    if (showQrScanner) startCamera()
    else stopScanCamera()
  }, [showQrScanner, startCamera, stopScanCamera])


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
            <button onClick={() => setShowQrScanner(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-lg" title="Scan QR Login">
              📷
            </button>
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
                    target={ssoEnabled ? '_self' : (ua.app.url !== '#' ? '_blank' : undefined)}
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
          <button onClick={() => setShowQrScanner(true)} className="flex flex-col items-center gap-1 px-4 py-1 text-slate-400">
            <span className="text-xl">📷</span>
            <span className="text-[10px] font-medium">Scan QR</span>
          </button>
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

      {/* Modal QR Scanner */}
      {showQrScanner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={closeQrScanner}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-white">📷 Scan QR Login</h3>
              <button onClick={closeQrScanner} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            {qrScanStatus === 'success' ? (
              <div className="text-center py-10 px-4">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-green-400 font-medium">{qrMsg}</p>
                <button onClick={closeQrScanner} className="mt-4 bg-slate-800 text-slate-300 text-sm px-4 py-2 rounded-xl">Tutup</button>
              </div>
            ) : (
              <>
                {/* Live camera view */}
                <div className="relative bg-black aspect-square">
                  <video ref={videoRef} autoPlay playsInline muted
                    className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Scan frame overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/60 rounded-xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
                    </div>
                  </div>
                  {qrScanStatus === 'loading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm">Memproses...</p>
                      </div>
                    </div>
                  )}
                  {!cameraActive && qrScanStatus !== 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm">Memulai kamera...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {qrMsg && (
                    <p className={`text-xs text-center ${qrScanStatus === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                      {qrMsg}
                    </p>
                  )}
                  {!qrMsg && cameraActive && (
                    <p className="text-xs text-slate-500 text-center">Arahkan kamera ke QR code di layar komputer</p>
                  )}
                  {/* Fallback: input manual */}
                  <div className="flex gap-2">
                    <input type="text" value={qrInput} onChange={e => setQrInput(e.target.value)}
                      placeholder="Atau tempel URL QR di sini..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500" />
                    <button
                      onClick={() => approveQrToken(extractToken(qrInput))}
                      disabled={!qrInput.trim() || qrScanStatus === 'loading'}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-xl">
                      OK
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
