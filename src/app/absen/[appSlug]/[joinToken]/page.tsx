'use client'
// Halaman absen mandiri member via QR absensi: zone.zomet.my.id/absen/<appSlug>/<joinToken>
// - Belum login: tombol Login (a /login).
// - Sudah login: tampil identitas member -> tombol "Absen Masuk" -> POST /api/absen
//   -> spoke selfCheckin (method='qr') -> sukses tercatat hadir.
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { CheckCircleFill, DoorOpenFill, BoxArrowRight, ArrowClockwise, ExclamationTriangleFill } from 'react-bootstrap-icons'

export default function AbsenPage({ params }: { params: Promise<{ appSlug: string; joinToken: string }> }) {
  const { appSlug, joinToken } = use(params)
  const [app, setApp] = useState<{ name: string; url: string } | null>(null)
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [already, setAlready] = useState(false)

  const path = `/absen/${appSlug}/${joinToken}`

  const load = async (silent = false) => {
    try {
      const res = await fetch(`/api/absen?app=${appSlug}&joinToken=${joinToken}`)
      const d = await res.json()
      if (res.ok) {
        setApp(d.app || null)
        setLoggedIn(Boolean(d.loggedIn))
        setUser({ name: d.name || '', email: d.email || '' })
        setError('')
      } else if (d?.error) setError(d.error)
    } catch { if (!silent) setError('Gagal memuat. Periksa jaringan.') }
  }

  useEffect(() => { load() }, [appSlug, joinToken])

  const handleAbsen = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appSlug, joinToken }),
      })
      const d = await res.json()
      if (res.status === 401) { window.location.href = `/login?callbackUrl=${path}`; return }
      setAlready(Boolean(d?.already))
      setDone(res.ok)
      if (!res.ok) throw new Error(d?.error || 'Gagal absen')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const or = app?.name || 'gym'

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-3">
              <DoorOpenFill size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold">Absen Masuk — {or}</h1>
            <p className="text-sm text-slate-400 mt-1">Scan QR absensi utk mencatat kedatanganmu</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              <ExclamationTriangleFill size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {done ? (
            <div className="text-center">
              <CheckCircleFill size={40} className="mx-auto mb-3 text-emerald-500" />
              <h2 className="text-lg font-bold mb-1">{already ? 'Sudah absen hari ini' : 'Absen Berhasil!'}</h2>
              <p className="text-sm text-slate-400 mb-6">
                {already ? 'Kamu sudah tercatat hadir di tenant ini hari ini.' : 'Kehadiranmu tercatat. Terima kasih sudah datang!'}
              </p>
              {app?.url && app.url !== '#' && (
                <a href={app.url} target="_blank" rel="noreferrer"
                  className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
                  Buka {app?.name} <BoxArrowRight size={16} className="inline ml-1" />
                </a>
              )}
            </div>
          ) : !app ? (
            <p className="text-center text-sm text-slate-400 py-6">Memuat... <ArrowClockwise size={14} className="inline animate-spin" /></p>
          ) : loggedIn ? (
            <div>
              <div className="flex items-center gap-3 bg-slate-700/40 border border-slate-600/40 rounded-xl px-4 py-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold">
                  {(user?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{user?.name || 'Member'}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
              <button onClick={handleAbsen} disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
                {loading ? 'Mencatat...' : 'Absen Masuk Sekarang'}
              </button>
              <p className="text-center text-xs text-slate-500 mt-3">Absen dicatat atas nama akun yang sedang login.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <a href={`/login?callbackUrl=${path}`}
                className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3.5 text-center transition-all active:scale-[0.98]">
                Login utk Absen
              </a>
              <Link href={`/register?callbackUrl=${path}`}
                className="block w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl py-3.5 text-center transition-all active:scale-[0.98]">
                Daftar akun baru
              </Link>
              <p className="text-center text-xs text-slate-500 pt-1">
                Login pakai akun Z One kamu. <span className="text-slate-300">Sudah jadi member {or}?</span> Absen langsung.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
