'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: string
  plan: string
  faceId: string | null
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if ((session?.user as any)?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchUsers()
  }, [status, session])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok) setUsers(data.users || [])
      else setError(data.error || 'Gagal fetch users')
    } catch {
      setError('Gagal fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFace = async (email: string) => {
    if (!confirm(`Hapus wajah untuk ${email}?`)) return
    try {
      const res = await fetch('/api/auth/unlink-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) fetchUsers()
    } catch {}
  }

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Hapus user ${email}? Tidak bisa dibatalkan!`)) return
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adminKey: 'admin123' }),
      })
      if (res.ok) fetchUsers()
    } catch {}
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white text-sm">← Kembali</button>
          <h1 className="font-bold text-white">⚙️ Admin Panel</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <div className="text-xs text-slate-400">Total Users</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{users.filter(u => u.faceId).length}</div>
            <div className="text-xs text-slate-400">Wajah Terdaftar</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{users.filter(u => u.role === 'ADMIN').length}</div>
            <div className="text-xs text-slate-400">Admin</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{users.filter(u => u.plan !== 'FREE').length}</div>
            <div className="text-xs text-slate-400">Paid Plans</div>
          </div>
        </div>

        {/* Search */}
        <input type="text" placeholder="🔍 Cari user..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {/* User list */}
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{user.name}</span>
                  {user.faceId && <span className="text-xs">📷</span>}
                  {user.role === 'ADMIN' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">ADMIN</span>}
                </div>
                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {user.plan} · {new Date(user.createdAt).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div className="flex gap-1">
                {user.faceId && (
                  <button onClick={() => handleDeleteFace(user.email)} title="Hapus wajah"
                    className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs">📷</button>
                )}
                <button onClick={() => handleDeleteUser(user.email)} title="Hapus user"
                  className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs">🗑️</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">Tidak ada user ditemukan</div>
          )}
        </div>
      </main>
    </div>
  )
}
