'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type State = 'loading' | 'confirm' | 'approved' | 'cancelled' | 'expired' | 'error' | 'need_login'

export default function QrApproveClient() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [state, setState] = useState<State>('loading')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') { setState('need_login'); return }
    if (!token) { setState('error'); return }

    // Beritahu server QR sudah di-scan
    fetch('/api/qr/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'scan' }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'SCANNED') {
          setUserName(d.user?.name || session?.user?.name || '')
          setState('confirm')
        } else {
          setState(d.error?.includes('kedaluwarsa') ? 'expired' : 'error')
        }
      })
      .catch(() => setState('error'))
  }, [status, token, session])

  const handleApprove = async () => {
    setState('loading')
    const res = await fetch('/api/qr/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'approve' }),
    })
    setState(res.ok ? 'approved' : 'error')
  }

  const handleCancel = async () => {
    setState('loading')
    await fetch('/api/qr/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'cancel' }),
    })
    setState('cancelled')
  }

  const wrap = (content: React.ReactNode) => (
    <div className="min-h-dvh bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-white text-center">
        {content}
      </div>
    </div>
  )

  if (state === 'loading') return wrap(
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
  )

  if (state === 'need_login') return wrap(
    <>
      <div className="text-4xl mb-4">🔐</div>
      <h2 className="font-bold text-lg mb-2">Perlu Login Dulu</h2>
      <p className="text-slate-400 text-sm mb-4">Login ke Z One di HP ini dulu, baru bisa approve QR.</p>
      <button onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(window.location.href)}`)}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl">
        Login ke Z One
      </button>
    </>
  )

  if (state === 'confirm') return wrap(
    <>
      <div className="text-4xl mb-4">📱</div>
      <h2 className="font-bold text-lg mb-1">Konfirmasi Login</h2>
      <p className="text-slate-400 text-sm mb-1">Akun yang akan digunakan:</p>
      <p className="font-semibold text-blue-400 mb-1">{userName}</p>
      <p className="text-slate-500 text-xs mb-6">Login ini akan mengizinkan perangkat lain (komputer/laptop) masuk ke Z One menggunakan akun kamu.</p>
      <button onClick={handleApprove}
        className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl mb-3">
        ✅ Ya, Izinkan Login
      </button>
      <button onClick={handleCancel}
        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 rounded-xl">
        ✕ Tolak
      </button>
    </>
  )

  if (state === 'approved') return wrap(
    <>
      <div className="text-5xl mb-4">✅</div>
      <h2 className="font-bold text-lg mb-2">Login Berhasil!</h2>
      <p className="text-slate-400 text-sm">Perangkat lain sudah masuk ke Z One. Halaman ini bisa ditutup.</p>
    </>
  )

  if (state === 'cancelled') return wrap(
    <>
      <div className="text-5xl mb-4">✕</div>
      <h2 className="font-bold text-lg mb-2">Login Ditolak</h2>
      <p className="text-slate-400 text-sm">Permintaan login dibatalkan. Halaman ini bisa ditutup.</p>
    </>
  )

  if (state === 'expired') return wrap(
    <>
      <div className="text-5xl mb-4">⏱️</div>
      <h2 className="font-bold text-lg mb-2">QR Kedaluwarsa</h2>
      <p className="text-slate-400 text-sm">QR code sudah tidak berlaku. Minta QR baru di komputer.</p>
    </>
  )

  return wrap(
    <>
      <div className="text-5xl mb-4">❌</div>
      <h2 className="font-bold text-lg mb-2">Terjadi Kesalahan</h2>
      <p className="text-slate-400 text-sm">QR tidak valid atau sudah digunakan.</p>
    </>
  )
}
