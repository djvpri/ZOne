'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Halaman reset password tanpa login: user memasukkan email + kode 6 digit
 * yang dikirim admin lewat WhatsApp, lalu menentukan password baru.
 */
export default function ResetPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (pass !== pass2) { setErr('Password baru dan ulangannya tidak sama'); return }
    if (pass.length < 8) { setErr('Password baru minimal 8 karakter'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: pass }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti password')
      setMsg('Password berhasil diganti. Mengalihkan ke halaman masuk…')
      setTimeout(() => router.push('/login'), 1500)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
        <h1 className="text-lg font-bold text-white mb-1">Atur ulang password</h1>
        <p className="text-xs text-slate-400 mb-5">
          Masukkan kode 6 digit yang dikirim admin (berlaku 15 menit), lalu tentukan password baru.
        </p>

        {err && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2 mb-3">{err}</div>}
        {msg && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl px-3 py-2 mb-3">{msg}</div>}

        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white mb-3"
          placeholder="nama@email.com" />

        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Kode reset</label>
        <input required inputMode="numeric" maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-lg tracking-[0.4em] text-center text-white mb-3"
          placeholder="000000" />

        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password baru</label>
        <input required type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white mb-3"
          placeholder="minimal 8 karakter" />

        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Ulangi password baru</label>
        <input required type="password" value={pass2} onChange={(e) => setPass2(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white mb-5"
          placeholder="ulangi" />

        <button type="submit" disabled={busy}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
          {busy ? 'Menyimpan…' : 'Simpan password baru'}
        </button>

        <a href="/login" className="block text-center text-xs text-slate-400 mt-4 underline">Kembali ke halaman masuk</a>
      </form>
    </div>
  )
}
