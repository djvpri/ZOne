'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

interface Tenant {
  id: string; name: string; plan?: string; active?: boolean; expires_at?: string | null; quota?: number
}
interface AppUser {
  id?: string; name: string; email?: string; faces?: number; linked_email?: string | null
}

const APPS: { key: string; label: string; icon: string }[] = [
  { key: 'zgold', label: 'ZGold POS', icon: '💰' },
  { key: 'zbengkel', label: 'ZBengkel', icon: '🔧' },
  { key: 'zlaundry', label: 'ZLaundry', icon: '🧺' },
  { key: 'zface', label: 'ZFace', icon: '📷' },
]

const PLANS = ['starter', 'pro', 'enterprise']

export default function ManageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeApp, setActiveApp] = useState(APPS[0].key)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newTenantName, setNewTenantName] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', tenantId: '' })
  const [userLoading, setUserLoading] = useState(false)

  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, session, router])

  const fetchData = useCallback(async (appKey: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/cross-app?app=${appKey}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail || 'Gagal memuat data')
      setUsers(data.users || [])
      setTenants(data.tenants || [])
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke app')
      setTenants([]); setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchData(activeApp)
  }, [isAdmin, activeApp, fetchData])

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const call = async (action: string, data: any) => {
    const res = await fetch('/api/admin/cross-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: activeApp, action, data }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || result.detail || 'Gagal')
    return result
  }

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTenantName.trim()) return
    try {
      await call('createTenant', { name: newTenantName.trim() })
      flash(`Tenant "${newTenantName}" dibuat`)
      setNewTenantName('')
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleSetPlan = async (tenantId: string, plan: string) => {
    try {
      await call('updatePlan', { tenantId, plan })
      flash(`Plan diubah ke ${plan.toUpperCase()}`)
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleSetExpiry = async (tenantId: string, plan: string, dateStr: string) => {
    if (!dateStr) return
    try {
      await call('updatePlan', { tenantId, plan, planExpires: new Date(dateStr).toISOString() })
      flash('Tanggal expired diperbarui')
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleDeleteTenant = async (tenantId: string, name: string) => {
    if (!confirm(`Hapus tenant "${name}"? Semua data di dalamnya ikut terhapus.`)) return
    try {
      await call('deleteTenant', { tenantId })
      flash('Tenant dihapus')
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserLoading(true)
    setError('')
    try {
      await call('create', {
        name: newUser.name, email: newUser.email, password: newUser.password,
        tenantId: newUser.tenantId || undefined,
      })
      flash(`User "${newUser.name}" ditambahkan`)
      setShowAddUser(false)
      setNewUser({ name: '', email: '', password: '', tenantId: '' })
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
    finally { setUserLoading(false) }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session || !isAdmin) return null

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 pt-safe">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">←</button>
          <h1 className="font-bold">🛠️ Kelola Apps</h1>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">🚪</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24">
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 cursor-pointer" onClick={() => setError('')}>{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3 mb-4">{success}</div>}

        <div className="flex gap-1 mb-5 bg-slate-800/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {APPS.map(a => (
            <button key={a.key} onClick={() => { setActiveApp(a.key); setError(''); setSuccess('') }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg transition ${activeApp === a.key ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
              <span>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <form onSubmit={handleAddTenant} className="flex gap-2 mb-5">
              <input value={newTenantName} onChange={e => setNewTenantName(e.target.value)}
                placeholder="Nama tenant baru" required
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl active:scale-95 transition">
                + Tenant
              </button>
            </form>

            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Tenant ({tenants.length})</h4>
              {tenants.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">Belum ada tenant</div>
              ) : (
                <div className="space-y-2">
                  {tenants.map(t => (
                    <div key={t.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">{t.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                          t.plan === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {(t.plan || 'starter').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {PLANS.map(p => (
                          <button key={p} onClick={() => handleSetPlan(t.id, p)}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                              t.plan === p ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                            }`}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {t.expires_at ? `Exp: ${new Date(t.expires_at).toLocaleDateString('id-ID')}` : 'Belum ada expiry'}
                        </span>
                        <input type="date" id={`exp-${t.id}`}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white" />
                        <button onClick={() => {
                          const el = document.getElementById(`exp-${t.id}`) as HTMLInputElement
                          handleSetExpiry(t.id, t.plan || 'starter', el.value)
                        }} className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg flex-shrink-0">
                          Set
                        </button>
                      </div>
                      <button onClick={() => handleDeleteTenant(t.id, t.name)}
                        className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                        🗑️ Hapus Tenant
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase">User ({users.length})</h4>
              <button onClick={() => setShowAddUser(true)} className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                + Tambah User
              </button>
            </div>
            {users.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">Belum ada user</div>
            ) : (
              <div className="space-y-2">
                {users.map((u, i) => (
                  <div key={u.id || i} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm font-medium">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.email || (u.linked_email ? `🔑 ${u.linked_email}` : 'belum ada email')}</div>
                    </div>
                    {typeof u.faces === 'number' && <span className="text-[10px] text-slate-500">{u.faces} foto</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddUser(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-bold mb-4">Tambah User ke {APPS.find(a => a.key === activeApp)?.label}</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <input required placeholder="Nama" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <input required type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <input required type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              {tenants.length > 0 && (
                <select value={newUser.tenantId} onChange={e => setNewUser({ ...newUser, tenantId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                  <option value="">Tanpa tenant</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 bg-slate-800 text-slate-300 text-sm font-semibold py-2.5 rounded-xl">Batal</button>
                <button type="submit" disabled={userLoading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  {userLoading ? '...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
