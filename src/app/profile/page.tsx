'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [faceStatus, setFaceStatus] = useState('')
  const [faceLoading, setFaceLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    return () => stopCamera()
  }, [status, router, stopCamera])

  if (status === 'loading' || !session) return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const user = session.user as any

  const handleCaptureFace = async () => {
    setFaceLoading(true)
    setError('')
    setSuccess('')
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
      setFaceStatus('Ambil foto wajah...')
      await new Promise(r => setTimeout(r, 2000))

      const video = videoRef.current!
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)

      const blob = await new Promise<Blob>(r => {
        canvas.toBlob(b => r(b!), 'image/jpeg', 0.8)
      })

      stopCamera()
      setFaceStatus('Mendaftarkan wajah...')

      const formData = new FormData()
      formData.append('name', user.name)
      formData.append('file', blob, 'face.jpg')

      const zfaceRes = await fetch('/api/auth/register-face', {
        method: 'POST',
        body: formData,
      })
      const zfaceData = await zfaceRes.json()

      if (!zfaceRes.ok) throw new Error(zfaceData.detail || zfaceData.error || 'Registrasi wajah gagal')

      const faceId = zfaceData.face_id || zfaceData.id

      const linkRes = await fetch('/api/auth/link-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, faceId }),
      })
      const linkData = await linkRes.json()

      if (!linkRes.ok) throw new Error(linkData.error || 'Gagal link wajah')

      setSuccess('✓ Wajah berhasil didaftarkan!')
      setFaceStatus('')
      await update()
    } catch (err) {
      setError((err as Error).message)
      setFaceStatus('')
    } finally {
      setFaceLoading(false)
    }
  }

  const handleUnlinkFace = async () => {
    if (!confirm('Yakin ingin menghapus wajah?')) return

    setFaceLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/unlink-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Gagal menghapus wajah')

      setSuccess('✓ Wajah berhasil dihapus')
      await update()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setFaceLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, currentPassword, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Gagal ganti password')

      setSuccess('✓ Password berhasil diganti')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 pt-safe">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
            ←
          </button>
          <h1 className="font-bold">Profil</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3">{success}</div>
        )}

        {/* Profile Info */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{user.name}</h2>
              <p className="text-slate-400 text-sm truncate">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs mb-1">Role</div>
              <div className="font-medium text-white">{user.role}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs mb-1">Plan</div>
              <div className="font-medium text-white">{user.plan || 'FREE'}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs mb-1">Wajah</div>
              <div className="font-medium">{user.faceId ? '✅ Terdaftar' : '❌ Belum'}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs mb-1">Status</div>
              <div className="font-medium text-green-400">Aktif</div>
            </div>
          </div>
        </div>

        {/* Face Management */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">📷 Pengaturan Wajah</h3>

          {faceStatus && (
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden mb-4">
              <video ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`} />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm p-3 text-center">
                {faceStatus}
              </div>
            </div>
          )}

          {user.faceId ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Wajah sudah terdaftar. Kamu bisa login dengan wajah.</p>
              <div className="flex gap-3">
                <button onClick={handleCaptureFace} disabled={faceLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-3 transition-colors text-sm active:scale-[0.98]">
                  {faceLoading ? 'Memproses...' : '🔄 Update'}
                </button>
                <button onClick={handleUnlinkFace} disabled={faceLoading}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-xl px-4 py-3 transition-colors text-sm border border-red-500/20 active:scale-[0.98]">
                  🗑️ Hapus
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Daftarkan wajah untuk login cepat.</p>
              <button onClick={handleCaptureFace} disabled={faceLoading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-3 transition-colors active:scale-[0.98]">
                {faceLoading ? faceStatus || 'Memproses...' : '📷 Daftarkan Wajah'}
              </button>
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">🔒 Ganti Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input type="password" required placeholder="Password saat ini" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <input type="password" required minLength={6} placeholder="Password baru (min 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <button type="submit" disabled={pwLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-3 transition-colors text-sm active:scale-[0.98]">
              {pwLoading ? 'Menyimpan...' : 'Ganti Password'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full bg-slate-800 hover:bg-slate-700 text-red-400 font-medium rounded-xl px-4 py-3 transition-colors active:scale-[0.98]">
          🚪 Keluar
        </button>
      </main>
    </div>
  )
}
