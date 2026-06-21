'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

interface Tenant {
  id: string; name: string; plan?: string; active?: boolean; expires_at?: string | null; quota?: number
}
interface AppUser {
  id?: string; name: string; email?: string; faces?: number; linked_email?: string | null; tenantId?: string | null
}

interface AppRow {
  id: string; slug: string; name: string; icon?: string | null; url: string; isActive: boolean
}

const PLANS = ['starter', 'pro', 'enterprise']

export default function ManageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [apps, setApps] = useState<AppRow[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [activeApp, setActiveApp] = useState('')
  const [showAddApp, setShowAddApp] = useState(false)
  const [newApp, setNewApp] = useState({ slug: '', name: '', url: '', icon: '📦' })
  const [appFormLoading, setAppFormLoading] = useState(false)
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

  const fetchApps = useCallback(async () => {
    setAppsLoading(true)
    try {
      const res = await fetch('/api/admin/apps')
      const data = await res.json()
      if (res.ok) {
        setApps(data.apps || [])
        if (data.apps?.length && !activeApp) setActiveApp(data.apps[0].slug)
      }
    } catch { setError('Gagal memuat daftar app') }
    finally { setAppsLoading(false) }
  }, [activeApp])

  useEffect(() => {
    if (isAdmin) fetchApps()
  }, [isAdmin, fetchApps])

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault()
    setAppFormLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApp),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menambah app')
      flash(`App "${newApp.name}" ditambahkan`)
      setShowAddApp(false)
      setNewApp({ slug: '', name: '', url: '', icon: '📦' })
      const apps2 = await (await fetch('/api/admin/apps')).json()
      setApps(apps2.apps || [])
      setActiveApp(result.app.slug)
    } catch (err: any) { setError(err.message) }
    finally { setAppFormLoading(false) }
  }

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
    if (isAdmin && activeApp) fetchData(activeApp)
  }, [isAdmin, activeApp, fetchData])

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const call = async (action: string, data: any, email?: string) => {
    const res = await fetch('/api/admin/cross-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: activeApp, action, email, data }),
    })
    const result = await res.json()
    if (!res.ok || result?.error) throw new Error(result.error || result.detail || 'Gagal')
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

  const handleDeleteUser = async (email: string | undefined, name: string) => {
    if (!email) { setError(`User "${name}" tidak punya email, tidak bisa dihapus dari sini.`); return }
    if (!confirm(`Hapus user "${name}" (${email})?\nTIDAK BISA DIBATALKAN.`)) return
    try {
      await call('delete', undefined, email)
      flash(`User "${name}" dihapus`)
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

        <div className="flex gap-1 mb-2 bg-slate-800/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {appsLoading ? (
            <div className="px-3 py-2.5 text-xs text-slate-500">Memuat app…</div>
          ) : (
            <>
              {apps.map(a => (
                <button key={a.slug} onClick={() => { setActiveApp(a.slug); setError(''); setSuccess('') }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg transition ${activeApp === a.slug ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                  <span>{a.icon || '📦'}</span>{a.name}
                  {a.url === '#' && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" title="URL belum diisi" />}
                </button>
              ))}
              <button onClick={() => setShowAddApp(true)}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 text-xs font-medium rounded-lg text-blue-400 border border-dashed border-blue-500/30">
                + App Baru
              </button>
            </>
          )}
        </div>

        {activeApp && apps.find(a => a.slug === activeApp) && (
          <div className="flex items-center gap-3 mb-4 text-[11px]">
            {apps.find(a => a.slug === activeApp)!.url !== '#' && (
              <a href={apps.find(a => a.slug === activeApp)!.url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 underline underline-offset-2">
                🔗 Buka {apps.find(a => a.slug === activeApp)!.name}
              </a>
            )}
            <button
              onClick={async () => {
                const current = apps.find(a => a.slug === activeApp)!
                const url = prompt(`URL admin API untuk "${current.name}" (mis. https://app-name.up.railway.app):`, current.url === '#' ? '' : current.url)
                if (!url) return
                try {
                  const res = await fetch('/api/admin/apps', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: current.id, url }),
                  })
                  if (!res.ok) throw new Error((await res.json()).error || 'Gagal update URL')
                  flash('URL app diperbarui')
                  fetchApps()
                  fetchData(activeApp)
                } catch (err: any) { setError(err.message) }
              }}
              className="text-blue-400 underline underline-offset-2"
            >
              ✏️ Edit URL
            </button>
          </div>
        )}

        {!appsLoading && apps.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-10">
            Belum ada app terdaftar. Tap <b>+ App Baru</b> buat mulai.
          </div>
        )}

        {activeApp && (loading ? (
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
                  <div key={u.id || i} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{u.email || (u.linked_email ? `🔑 ${u.linked_email}` : 'belum ada email')}</div>
                      <div className="text-[10px] text-blue-400/80 truncate">
                        🏢 {u.tenantId ? (tenants.find(t => t.id === u.tenantId)?.name || 'Tenant tidak ditemukan') : 'Tanpa tenant'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {typeof u.faces === 'number' && <span className="text-[10px] text-slate-500">{u.faces} foto</span>}
                      {u.email && (
                        <button onClick={() => handleDeleteUser(u.email, u.name)}
                          className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                          🗑️ Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ))}
      </main>

      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddUser(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-bold mb-4">Tambah User ke {apps.find(a => a.slug === activeApp)?.name}</h3>
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
      {showAddApp && (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddApp(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-bold mb-4">Tambah App Baru</h3>
            <form onSubmit={handleAddApp} className="space-y-3">
              <input required placeholder="Nama (mis. ZKasir)" value={newApp.name}
                onChange={e => setNewApp({ ...newApp, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <input required placeholder="Slug (mis. zkasir, huruf kecil)" value={newApp.slug}
                onChange={e => setNewApp({ ...newApp, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <input required type="url" placeholder="https://zkasir-production.up.railway.app" value={newApp.url}
                onChange={e => setNewApp({ ...newApp, url: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <input placeholder="Emoji icon (opsional, mis. 🛒)" value={newApp.icon}
                onChange={e => setNewApp({ ...newApp, icon: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm placeholder:text-slate-500" />
              <p className="text-[11px] text-slate-500">
                App baru harus sudah implement endpoint <code className="text-blue-400">/api/admin/cross-app</code> dengan secret <code className="text-blue-400">CROSS_APP_SECRET</code> yang sama, supaya bisa dikelola dari sini.
              </p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddApp(false)} className="flex-1 bg-slate-800 text-slate-300 text-sm font-semibold py-2.5 rounded-xl">Batal</button>
                <button type="submit" disabled={appFormLoading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  {appFormLoading ? '...' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
