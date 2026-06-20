'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type LoginMode = 'password' | 'face'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [faceStatus, setFaceStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const router = useRouter()

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // Password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError('Email atau password salah')
    else router.push('/dashboard')
  }

  // Face login — proper flow
  const handleFaceLogin = async () => {
    if (!email) {
      setError('Masukkan email terlebih dahulu')
      return
    }

    setLoading(true)
    setError('')
    setFaceStatus('Mengaktifkan kamera...')

    try {
      // 1. Start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }

      // 2. Wait for camera ready
      await new Promise(resolve => setTimeout(resolve, 1500))
      setFaceStatus('Mendeteksi wajah...')

      // 3. Capture frame
      const video = videoRef.current!
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
      })

      // 4. Send to ZFace /api/auth/face-login (no org_id needed)
      setFaceStatus('Memverifikasi wajah...')
      const formData = new FormData()
      formData.append('file', blob, 'face.jpg')

      const zfaceRes = await fetch('https://zface.zomet.my.id/api/auth/face-login', {
        method: 'POST',
        body: formData,
      })

      if (!zfaceRes.ok) {
        const errData = await zfaceRes.json().catch(() => ({}))
        throw new Error(errData.detail || 'Wajah tidak terdaftar')
      }

      const zfaceData = await zfaceRes.json()
      const personName = zfaceData.person.name
      const similarity = zfaceData.person.similarity
      const faceToken = zfaceData.access_token

      setFaceStatus(`✓ ${personName} (${(similarity * 100).toFixed(0)}%) — Login...`)

      // 5. Send face token to ZOne /api/auth/face-verify
      const verifyRes = await fetch('/api/auth/face-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceToken, email }),
      })

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Verifikasi gagal')
      }

      const verifyData = await verifyRes.json()

      // 6. Sign in with the verified credentials
      const signInRes = await signIn('credentials', {
        email: verifyData.email,
        password: `face:${verifyData.name}`,
        redirect: false,
      })

      stopCamera()

      if (signInRes?.error) {
        setError('Login gagal setelah verifikasi wajah')
        setFaceStatus('')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Face login error:', err)
      setError((err as Error).message || 'Face login gagal')
      setFaceStatus('')
      stopCamera()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-blue-500/25">
            <span className="text-3xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Z One</h1>
          <p className="text-slate-400 mt-1">Satu platform, semua aplikasi</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('password'); stopCamera(); setFaceStatus(''); setError('') }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              mode === 'password' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🔑 Password
          </button>
          <button
            onClick={() => { setMode('face'); setError(''); setFaceStatus('') }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              mode === 'face' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            📷 Wajah
          </button>
        </div>

        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2 mb-4">
              {error}
            </div>
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin@zone.id" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors">
                {loading ? 'Masuk...' : 'Masuk'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="admin@zone.id" />
              </div>

              <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted
                  className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`} />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">📷</span>
                      <p className="text-slate-400 text-sm">Kamera belum aktif</p>
                    </div>
                  </div>
                )}
                {faceStatus && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm p-2 text-center">
                    {faceStatus}
                  </div>
                )}
              </div>

              <button onClick={handleFaceLogin} disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors">
                {loading ? 'Memproses...' : '📷 Login dengan Wajah'}
              </button>
            </div>
          )}

          <p className="text-center text-xs text-slate-500 mt-4">Demo: admin@zone.id / admin123</p>
        </div>
      </div>
    </div>
  )
}
