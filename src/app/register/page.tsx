'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [step, setStep] = useState(1)  // 1: form, 2: face, 3: done
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [faceStatus, setFaceStatus] = useState('')
  const [registered, setRegistered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const router = useRouter()

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Gagal daftar')
      
      setStep(2)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCaptureFace = async () => {
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
      }

      await new Promise(resolve => setTimeout(resolve, 1500))
      setFaceStatus('Ambil foto wajah...')
      // Auto-capture after 2 more seconds
      await new Promise(resolve => setTimeout(resolve, 2000))

      const video = videoRef.current!
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
      })

      stopCamera()
      setFaceStatus('Mendaftarkan wajah...')

      // Register face to ZFace with person name = user's name
      const formData = new FormData()
      formData.append('name', name)
      formData.append('file', blob, 'face.jpg')

      const zfaceRes = await fetch('/api/auth/register-face', {
        method: 'POST',
        body: formData,
      })
      const zfaceData = await zfaceRes.json()

      if (!zfaceRes.ok) throw new Error(zfaceData.detail || zfaceData.error || 'Registrasi wajah gagal')

      const faceId = zfaceData.face_id || zfaceData.id

      // Save faceId to user in ZOne
      await fetch('/api/auth/link-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, faceId }),
      })

      setFaceStatus('✓ Registrasi berhasil!')
      setRegistered(true)
      setStep(3)
    } catch (err) {
      setError((err as Error).message)
      setFaceStatus('')
    } finally {
      setLoading(false)
    }
  }

  const skipFace = () => {
    setRegistered(true)
    setStep(3)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-blue-500/25">
            <span className="text-3xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Daftar Z One</h1>
          <p className="text-slate-400 mt-1">Satu akun untuk semua aplikasi</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2 mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Form */}
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nama</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min 6 karakter" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors">
                {loading ? 'Mendaftar...' : 'Daftar'}
              </button>
              <p className="text-center text-sm text-slate-400">
                Sudah punya akun? <Link href="/login" className="text-blue-400 hover:underline">Masuk</Link>
              </p>
            </form>
          )}

          {/* Step 2: Capture Face */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 text-center">
                📷 Foto wajah untuk login cepat (opsional)
              </p>

              <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted
                  className={`w-full h-full object-cover ${loading ? '' : 'hidden'}`} />
                <canvas ref={canvasRef} className="hidden" />
                {!loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">📷</span>
                      <p className="text-slate-400 text-sm">Klik tombol untuk mulai</p>
                    </div>
                  </div>
                )}
                {faceStatus && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm p-2 text-center">
                    {faceStatus}
                  </div>
                )}
              </div>

              <button onClick={handleCaptureFace} disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors">
                {loading ? faceStatus : '📷 Ambil Foto Wajah'}
              </button>

              <button onClick={skipFace} disabled={loading}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg px-4 py-2 transition-colors">
                Lewati (nanti)
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <span className="text-5xl block mb-2">🎉</span>
              <p className="text-white font-medium">Pendaftaran berhasil!</p>
              <p className="text-sm text-slate-400">
                {registered ? 'Sekarang kamu bisa login dengan password atau wajah' : 'Akun sudah dibuat'}
              </p>
              <Link href="/login"
                className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-center">
                Masuk Sekarang
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
