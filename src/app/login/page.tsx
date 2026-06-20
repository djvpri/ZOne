'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

type LoginMode = 'password' | 'face'

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

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

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

      // Use signIn from next-auth/react
      const signInRes = await signIn('credentials', {
        email: verifyData.email,
        password: `face:${verifyData.personName || verifyData.name}`,
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
            {/* Login mode */}
            <div className="flex gap-1 mb-4 bg-slate-800/30 p-1 rounded-lg">
              <button onClick={() => { setLoginMode('password'); setError(''); stopCamera(); setFaceStatus('') }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-md transition ${loginMode === 'password' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                🔑 Password
              </button>
              <button onClick={() => { setLoginMode('face'); setError(''); setFaceStatus('') }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-md transition ${loginMode === 'face' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                📷 Wajah
              </button>
            </div>

            {loginMode === 'password' ? (
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
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                  <video ref={videoRef} autoPlay playsInline muted
                    className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`} />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-4xl mb-3 block">📷</span>
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
                  {loading ? 'Memproses...' : '📷 Login dengan Wajah'}
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

        <p className="mt-6 text-center text-xs text-slate-600">
          v1.0 · Z One Platform
        </p>
      </div>
    </div>
  )
}
