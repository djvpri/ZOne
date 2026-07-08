'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Stars, Key, Camera, Phone, CheckCircleFill, Clock, ArrowRepeat } from 'react-bootstrap-icons'

type LoginMode = 'password' | 'face' | 'qr'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [faceStatus, setFaceStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // QR Login state
  const [qrId, setQrId] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'pending' | 'scanned' | 'approved' | 'expired'>('idle')
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Maintenance banner
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setMaintenance({
          enabled: d.settings?.maintenance_enabled === 'true',
          message: d.settings?.maintenance_message || '',
        })
      })
      .catch(() => {})
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const stopQrPolling = useCallback(() => {
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null }
  }, [])

  const generateQr = useCallback(async () => {
    stopQrPolling()
    setQrStatus('pending')
    try {
      const res = await fetch('/api/qr/generate', { method: 'POST' })
      const d = await res.json()
      setQrId(d.id); setQrToken(d.token); setQrExpiry(new Date(d.expiresAt))

      // Poll tiap 2 detik
      qrPollRef.current = setInterval(async () => {
        const pr = await fetch(`/api/qr/poll?id=${d.id}`)
        const pd = await pr.json()
        if (pd.status === 'SCANNED') { setQrStatus('scanned') }
        if (pd.status === 'APPROVED') {
          stopQrPolling(); setQrStatus('approved')
          // Buat sesi login NextAuth lewat credentials khusus
          await signIn('credentials', {
            email: pd.user.email,
            password: `qr:${d.token}`,
            redirect: false,
          })
          router.push('/dashboard')
        }
        if (pd.status === 'EXPIRED' || pd.status === 'CANCELLED') {
          stopQrPolling(); setQrStatus('expired')
        }
      }, 2000)

      // Auto-expire di sisi client juga
      setTimeout(() => {
        if (qrPollRef.current) { stopQrPolling(); setQrStatus('expired') }
      }, 62000)
    } catch { setQrStatus('idle') }
  }, [stopQrPolling, router])

  useEffect(() => {
    if (loginMode === 'qr') generateQr()
    else stopQrPolling()
  }, [loginMode, generateQr, stopQrPolling])

  useEffect(() => {
    return () => { stopCamera(); stopQrPolling() }
  }, [stopCamera, stopQrPolling])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      
      if (res?.error) {
        setError('Email atau password salah')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Gagal login')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoLogin() {
    setLoading(true)
    setError('')
    try {
      const res = await signIn('credentials', {
        email: 'demo@zomet.my.id',
        password: 'demo-one-click',
        redirect: false,
      })
      if (res?.error) setError('Akun demo belum siap. Coba lagi nanti.')
      else router.push('/dashboard')
    } catch {
      setError('Gagal masuk sebagai demo')
    } finally {
      setLoading(false)
    }
  }

  async function handleFaceLogin() {
    setLoading(true)
    setError('')
    setFaceStatus('Mengaktifkan kamera...')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }

      await new Promise(r => setTimeout(r, 1500))
      setFaceStatus('Mendeteksi wajah...')
      await new Promise(r => setTimeout(r, 1500))

      const video = videoRef.current!
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)

      const blob = await new Promise<Blob>(r => {
        canvas.toBlob(b => r(b!), 'image/jpeg', 0.8)
      })

      stopCamera()
      setFaceStatus('Memverifikasi wajah...')

      const formData = new FormData()
      formData.append('file', blob, 'face.jpg')

      let zfaceData: any = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 30000)
          const res = await fetch('/api/auth/face-login', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || errData.error || 'Wajah tidak terdaftar')
          }
          zfaceData = await res.json()
          break
        } catch (err: any) {
          if (attempt < 3) {
            setFaceStatus(`Mencoba ulang... (${attempt}/3)`)
            await new Promise(r => setTimeout(r, 1000))
            continue
          }
          throw err
        }
      }

      if (!zfaceData) throw new Error('Gagal menghubungi ZFace')
      setFaceStatus(`✓ ${zfaceData.person.name} — Login...`)

      const verifyRes = await fetch('/api/auth/face-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceToken: zfaceData.access_token }),
      })
      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Verifikasi gagal')
      }

      const verifyData = await verifyRes.json()

      // Login pakai loginToken bertanda tangan dari face-verify.
      // authorize() memverifikasi JWT-nya, jadi tidak bisa dipalsukan.
      const signInRes = await signIn('credentials', {
        email: verifyData.email,
        password: `verified-face:${verifyData.loginToken}`,
        redirect: false,
      })

      if (signInRes?.error) {
        throw new Error('Login gagal setelah verifikasi')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Face login gagal')
      setFaceStatus('')
      stopCamera()
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, phone: regPhone, password: regPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      // Auto login after register
      const signInRes = await signIn('credentials', {
        email: regEmail,
        password: regPassword,
        redirect: false,
      })
      if (signInRes?.error) {
        window.location.href = '/login'
      } else {
        router.push('/dashboard')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <span className="text-3xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-xl font-bold">Z One</h1>
          <p className="text-sm text-slate-400 mt-1">Ekosistem Digital</p>
        </div>

        {/* Banner Maintenance */}
        {maintenance?.enabled && (
          <div className="mb-5 flex gap-3 items-start bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <span className="text-yellow-400 mt-0.5 shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-yellow-400">Sedang Pemeliharaan</p>
              {maintenance.message && (
                <p className="text-xs text-yellow-300/80 mt-0.5">{maintenance.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-800/50 p-1 rounded-xl">
          <button onClick={() => { setIsLogin(true); setError(''); stopCamera(); setFaceStatus('') }}
            className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            Masuk
          </button>
          <button onClick={() => { setIsLogin(false); setError(''); stopCamera(); setFaceStatus('') }}
            className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            Daftar
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {isLogin ? (
          <>
            {/* Coba sebagai Demo — satu klik, tanpa ketik kredensial */}
            <button onClick={handleDemoLogin} disabled={loading}
              className="w-full mb-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <Stars size={16} /> {loading ? 'Masuk...' : 'Coba Langsung sebagai Demo'}
            </button>
            <p className="text-center text-[11px] text-slate-500 mb-4">Tanpa daftar — langsung jelajahi ekosistem</p>

            {/* Login mode */}
            <div className="flex gap-1 mb-4 bg-slate-800/30 p-1 rounded-lg">
              <button onClick={() => { setLoginMode('password'); setError(''); stopCamera(); setFaceStatus('') }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-md transition ${loginMode === 'password' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                <Key size={14} className="inline mr-1" /> Password
              </button>
              <button onClick={() => { setLoginMode('face'); setError(''); setFaceStatus('') }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-md transition ${loginMode === 'face' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                <Camera size={14} className="inline mr-1" /> Wajah
              </button>
            </div>

            {loginMode === 'password' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Email</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    autoComplete="email" inputMode="email" required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Password</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    autoComplete="current-password" required />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
                  {loading ? 'Masuk...' : 'Masuk'}
                </button>
              </form>
            )}

            {loginMode === 'face' && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                  <video ref={videoRef} autoPlay playsInline muted
                    className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`} />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Camera size={40} className="mb-3 mx-auto text-slate-500" />
                        <p className="text-sm text-slate-400">Klik tombol di bawah</p>
                      </div>
                    </div>
                  )}
                  {faceStatus && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm p-3 text-center">
                      {faceStatus}
                    </div>
                  )}
                </div>
                <button onClick={handleFaceLogin} disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
                  {loading ? 'Memproses...' : (<><Camera size={16} className="inline mr-1.5" />Login dengan Wajah</>)}
                </button>
              </div>
            )}

            {loginMode === 'qr' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 text-center">Scan QR ini dari HP yang sudah login di Z One</p>
                <div className="bg-white rounded-2xl p-4 flex items-center justify-center aspect-square max-w-[220px] mx-auto">
                  {qrStatus === 'pending' && qrToken ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('https://zone.zomet.my.id/qr-approve?token=' + qrToken)}`}
                      alt="QR Login"
                      className="w-full h-full"
                    />
                  ) : qrStatus === 'scanned' ? (
                    <div className="text-center">
                      <Phone size={40} className="mb-2 mx-auto text-slate-600" />
                      <p className="text-slate-600 text-sm font-medium">QR Di-scan!</p>
                      <p className="text-slate-500 text-xs">Konfirmasi di HP...</p>
                    </div>
                  ) : qrStatus === 'approved' ? (
                    <div className="text-center">
                      <CheckCircleFill size={40} className="mb-2 mx-auto text-emerald-500" />
                      <p className="text-slate-600 text-sm font-medium">Masuk...</p>
                    </div>
                  ) : qrStatus === 'expired' ? (
                    <div className="text-center">
                      <Clock size={40} className="mb-2 mx-auto text-amber-500" />
                      <p className="text-slate-600 text-sm font-medium">QR Kedaluwarsa</p>
                    </div>
                  ) : (
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {qrExpiry && qrStatus === 'pending' && (
                  <p className="text-center text-xs text-slate-500">
                    Berlaku hingga {qrExpiry.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                )}
                {(qrStatus === 'expired' || qrStatus === 'idle') && (
                  <button onClick={generateQr}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3.5 transition-all">
                    <ArrowRepeat size={15} className="inline mr-1.5" />Generate QR Baru
                  </button>
                )}
              </div>
            )}

            {/* Shortcut QR — tampil di bawah form password/face */}
            {loginMode !== 'qr' && isLogin && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <button onClick={() => setLoginMode('qr')}
                  className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-2">
                  <Phone size={13} /> Login dengan QR code dari HP
                </button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Nama Lengkap</label>
              <input type="text" value={regName} required
                onChange={e => setRegName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Email</label>
              <input type="email" value={regEmail} required
                onChange={e => setRegEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="email" inputMode="email" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">No. HP</label>
              <input type="tel" value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                inputMode="tel" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Password</label>
              <input type="password" value={regPassword} required minLength={6}
                onChange={e => setRegPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
              {loading ? 'Mendaftar...' : 'Daftar'}
            </button>
          </form>
        )}

        {/* Google Login/Register */}
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">atau</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98] text-sm">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.6 0 6.7 5.4 2.8 13.3l8 6.2C12.8 13.2 17.9 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-9.9 6.9-17.1z"/>
              <path fill="#FBBC05" d="M10.8 28.5A14.4 14.4 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5l-8-6.2A23.8 23.8 0 0 0 0 24c0 3.9.9 7.5 2.8 10.7l8-6.2z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.1 0-11.2-3.7-13.2-9l-8 6.2C6.7 42.6 14.6 48 24 48z"/>
            </svg>
            {isLogin ? 'Login dengan Google' : 'Daftar dengan Google'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          v1.0 · Z One Platform
        </p>
        <p className="mt-2 text-center text-[10px] text-slate-700">
          © {new Date().getFullYear()} PT Zomet Teknologi Indonesia
        </p>
      </div>
    </div>
  )
}
