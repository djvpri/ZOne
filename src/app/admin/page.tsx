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
  phone: string | null
  faceId: string | null
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'users' | 'settings'>('users')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if ((session?.user as any)?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [session])

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

  const handleRoleChange = async (email: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      })
      if (res.ok) {
        setSuccess(`Role ${email} diubah ke ${newRole}`)
        fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || 'Gagal update role')
      }
    } catch { setError('Gagal update role') }
  }

  const handlePlanChange = async (email: string, newPlan: string) => {
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: newPlan }),
      })
      if (res.ok) {
        setSuccess(`Plan ${email} diubah ke ${newPlan}`)
        fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || 'Gagal update plan')
      }
    } catch { setError('Gagal update plan') }
  }

  const handleDeleteFace = async (email: string) => {
    if (!confirm(`Hapus wajah untuk ${email}?`)) return
    try {
      const res = await fetch('/api/auth/unlink-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) { setSuccess('Wajah dihapus'); fetchUsers() }
    } catch {}
  }

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Hapus user ${email}? TIDAK BISA DIBATALKAN!`)) return
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adminKey: 'admin123' }),
      })
      if (res.ok) { setSuccess('User dihapus'); fetchUsers() }
    } catch {}
  }

  const handleResetPassword = async (email: string) => {
    const newPass = prompt(`Password baru untuk ${email}:`)
    if (!newPass || newPass.length < 6) return
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPass }),
      })
      if (res.ok) setSuccess(`Password ${email} di-reset`)
      else { const data = await res.json(); setError(data.error || 'Gagal reset password') }
    } catch { setError('Gagal reset password') }
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if ((session?.user as any)?.role !== 'ADMIN') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
          <p className="text-slate-400 mb-4">Kamu bukan admin</p>
          <button onClick={() => router.push('/dashboard')} className="bg-blue-600 text-white px-6 py-2 rounded-lg">
            Kembali
          </button>
        </div>
      </div>
    )
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: users.length,
    face: users.filter(u => u.faceId).length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    paid: users.filter(u => u.plan !== 'FREE').length,
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 pt-safe">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">←</button>
          <h1 className="font-bold text-white">⚙️ Admin Panel</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 pb-24">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4" onClick={() => setError('')}>
            {error} · tap untuk tutup
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3 mb-4" onClick={() => setSuccess('')}>
            {success} · tap untuk tutup
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-400">Total Users</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.face}</div>
            <div className="text-xs text-slate-400">Wajah</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.admin}</div>
            <div className="text-xs text-slate-400">Admin</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.paid}</div>
            <div className="text-xs text-slate-400">Paid</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-800/50 p-1 rounded-xl">
          <button onClick={() => setTab('users')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${tab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            👥 Users ({users.length})
          </button>
          <button onClick={() => setTab('settings')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${tab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            ⚙️ Settings
          </button>
        </div>

        {tab === 'users' ? (
          <>
            {/* Search */}
            <div className="relative mb-5">
              <input type="text" placeholder="Cari user..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
            </div>

            {/* User list */}
            <div className="space-y-3">
              {filtered.map(user => (
                <div key={user.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{user.name}</span>
                        {user.faceId && <span className="text-xs">📷</span>}
                        {user.role === 'ADMIN' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">ADMIN</span>}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{user.email}</div>
                      {user.phone && <div className="text-xs text-slate-500">📱 {user.phone}</div>}
                      <div className="text-[10px] text-slate-500 mt-1">
                        {user.plan} · {new Date(user.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Role toggle */}
                    <button onClick={() => handleRoleChange(user.email, user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 active:scale-95">
                      {user.role === 'ADMIN' ? '↓ Turunkan ke USER' : '↑ Jadikan ADMIN'}
                    </button>

                    {/* Plan cycle */}
                    {['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].map(plan => (
                      <button key={plan} onClick={() => handlePlanChange(user.email, plan)}
                        disabled={user.plan === plan}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border active:scale-95 ${
                          user.plan === plan
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}>
                        {plan}
                      </button>
                    ))}

                    {/* Reset password */}
                    <button onClick={() => handleResetPassword(user.email)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 active:scale-95">
                      🔑 Reset PW
                    </button>

                    {/* Delete face */}
                    {user.faceId && (
                      <button onClick={() => handleDeleteFace(user.email)}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 active:scale-95">
                        📷 Hapus Wajah
                      </button>
                    )}

                    {/* Delete user */}
                    <button onClick={() => handleDeleteUser(user.email)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 active:scale-95">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-8">Tidak ada user</div>
              )}
            </div>
          </>
        ) : (
          /* Settings Tab */
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">🔐 ZOne Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">URL</span><span className="text-white">zone-production-0099.up.railway.app</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Version</span><span className="text-white">v1.0</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Total Apps</span><span className="text-white">12</span></div>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">🌐 Z-Apps</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">ZFace</span><a href="https://zface.zomet.my.id" target="_blank" className="text-blue-400">zface.zomet.my.id →</a></div>
                <div className="flex justify-between"><span className="text-slate-400">ZGold</span><a href="https://zgold-production.up.railway.app" target="_blank" className="text-blue-400">zgold-production →</a></div>
                <div className="flex justify-between"><span className="text-slate-400">ZBengkel</span><a href="https://zbengkel-production.up.railway.app" target="_blank" className="text-blue-400">zbengkel-production →</a></div>
                <div className="flex justify-between"><span className="text-slate-400">ZLaundry</span><a href="https://zlaundry-production.up.railway.app" target="_blank" className="text-blue-400">zlaundry-production →</a></div>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">📊 Database</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Engine</span><span className="text-white">PostgreSQL</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ORM</span><span className="text-white">Prisma</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Auth</span><span className="text-white">NextAuth v5 (JWT)</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
