'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('done')
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
          <h1 className="text-xl font-bold">Daftar Z One</h1>
          <p className="text-sm text-slate-400 mt-1">Buat akun baru</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Nama Lengkap</label>
              <input type="text" value={name} required
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Email</label>
              <input type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="email" inputMode="email" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">No. HP</label>
              <input type="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                inputMode="tel" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Password</label>
              <input type="password" value={password} required minLength={6}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
              {loading ? 'Mendaftar...' : 'Daftar'}
            </button>
          </form>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-lg font-bold mb-2">Berhasil Daftar!</h2>
            <p className="text-sm text-slate-400 mb-6">Akun kamu sudah aktif. Login sekarang.</p>
            <Link href="/login"
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98]">
              Login
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          Sudah punya akun? <Link href="/login" className="text-blue-400 hover:text-blue-300">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
