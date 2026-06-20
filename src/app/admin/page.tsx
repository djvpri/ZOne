'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

interface ZOneUser {
  id: string; name: string; email: string; role: string; faceId: string | null; phone: string | null; createdAt: string
}
interface CrossAppUser {
  id: string; name: string; email: string; role: string; faceId: string | null; tenantId?: number; aktif?: boolean; createdAt: string
}

type Tab = 'zone' | 'zgold' | 'zbengkel' | 'zlaundry' | 'zface' | 'settings'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('zone')
  const [zoneUsers, setZoneUsers] = useState<ZOneUser[]>([])
  const [crossUsers, setCrossUsers] = useState<CrossAppUser[]>([])
  const [crossExtra, setCrossExtra] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [crossLoading, setCrossLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState('USER')
  const [addLoading, setAddLoading] = useState(false)
  const [showCrossAdd, setShowCrossAdd] = useState(false)
  const [crossAppName, setCrossAppName] = useState('')
  const [crossAppEmail, setCrossAppEmail] = useState('')
  const [crossAppPhone, setCrossAppPhone] = useState('')
  const [crossAppPassword, setCrossAppPassword] = useState('')
  const [crossAppRole, setCrossAppRole] = useState('')
  const [crossAppLoading, setCrossAppLoading] = useState(false)

  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, session, router])

  useEffect(() => {
    if (isAdmin) fetchZoneUsers()
  }, [isAdmin])

  const fetchZoneUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok) setZoneUsers(data.users || [])
    } catch { setError('Gagal fetch ZOne users') }
    finally { setLoading(false) }
  }

  const fetchCrossUsers = useCallback(async (appKey: string) => {
    setCrossLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/cross-app?app=${appKey}`)
      const data = await res.json()
      if (res.ok) {
        setCrossUsers(data.users || [])
        setCrossExtra(data)
      }
      else setError(data.error || 'Gagal fetch users')
    } catch { setError('Gagal fetch users dari app') }
    finally { setCrossLoading(false) }
  }, [])

  useEffect(() => {
    if (tab !== 'zone' && tab !== 'settings') fetchCrossUsers(tab)
  }, [tab, fetchCrossUsers])

  const handleAction = async (appKey: string, action: string, email: string, data?: any) => {
    try {
      const res = await fetch('/api/admin/cross-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appKey, action, email, data }),
      })
      const result = await res.json()
      if (res.ok) { setSuccess(`${action} berhasil`); fetchCrossUsers(appKey) }
      else setError(result.error || 'Gagal')
    } catch { setError('Gagal melakukan aksi') }
  }

  const handleZoneAction = async (action: string, email: string, data?: any) => {
    try {
      let url = '/api/admin/update-user'
      if (action === 'delete') url = '/api/admin/delete-user'
      if (action === 'unlink-face') url = '/api/auth/unlink-face'

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'unlink-face' ? { email } : { email, ...(action === 'delete' ? { adminKey: 'admin123' } : data) }),
      })
      if (res.ok) { setSuccess(`${action} berhasil`); fetchZoneUsers() }
      else { const d = await res.json(); setError(d.error || 'Gagal') }
    } catch { setError('Gagal') }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName, email: addEmail, phone: addPhone, password: addPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal daftarkan user')

      // If role is ADMIN, update it after registration
      if (addRole === 'ADMIN') {
        await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: addEmail, role: 'ADMIN' }),
        })
      }

      setSuccess(`User ${addName} berhasil didaftarkan!`)
      setShowAddUser(false)
      setAddName(''); setAddEmail(''); setAddPhone(''); setAddPassword(''); setAddRole('USER')
      fetchZoneUsers()
    } catch (err: any) {
      setError(err.message || 'Gagal daftarkan user')
    } finally {
      setAddLoading(false)
    }
  }

  const handleCrossAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCrossAppLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/cross-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: tab,
          action: 'create',
          data: {
            name: crossAppName,
            email: crossAppEmail,
            password: crossAppPassword,
            role: crossAppRole || undefined,
            phone: crossAppPhone || undefined,
          },
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal daftarkan user')

      setSuccess(`User ${crossAppName} berhasil ditambahkan ke ${tab.toUpperCase()}!`)
      setShowCrossAdd(false)
      setCrossAppName(''); setCrossAppEmail(''); setCrossAppPhone(''); setCrossAppPassword(''); setCrossAppRole('')
      fetchCrossUsers(tab)
    } catch (err: any) {
      setError(err.message || 'Gagal')
    } finally {
      setCrossAppLoading(false)
    }
  }

  const handleCrossDelete = async (email: string, name: string) => {
    if (!confirm(`Hapus user ${name} (${email}) dari ${tab.toUpperCase()}?\nTIDAK BISA DIBATALKAN!`)) return
    try {
      const res = await fetch('/api/admin/cross-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: tab, action: 'delete', email }),
      })
      if (res.ok) { setSuccess(`User ${name} dihapus dari ${tab.toUpperCase()}`); fetchCrossUsers(tab) }
      else { const d = await res.json(); setError(d.error || 'Gagal hapus') }
    } catch { setError('Gagal hapus user') }
  }

  const handleCrossPlanAction = async (tenantId: string, plan: string, planExpires?: string) => {
    try {
      const res = await fetch('/api/admin/cross-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: tab,
          action: 'updatePlan',
          data: { tenantId, plan, planExpires: planExpires || undefined },
        }),
      })
      const result = await res.json()
      if (res.ok) {
        setSuccess(`Plan ${tab.toUpperCase()} diubah ke ${plan.toUpperCase()}`)
        fetchCrossUsers(tab)
      } else {
        setError(result.error || 'Gagal update plan')
      }
    } catch { setError('Gagal update plan') }
  }

  const handleTenantAction = async (action: string, data: any) => {
    try {
      const res = await fetch('/api/admin/cross-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: tab, action, data }),
      })
      const result = await res.json()
      if (res.ok) {
        setSuccess(`Tenant berhasil di-${action === 'deleteTenant' ? 'hapus' : 'update'}`)
        fetchCrossUsers(tab)
      } else {
        setError(result.error || 'Gagal')
      }
    } catch { setError('Gagal aksi tenant') }
  }

  const handleCreateTenant = async () => {
    const nama = prompt('Nama Toko:')
    if (!nama) return
    const slug = nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    const useSlug = prompt(`Slug (tekan Enter untuk "${slug}"):`, slug)
    handleTenantAction('createTenant', { namaToko: nama, slug: useSlug || slug })
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
      <div className="text-center p-8">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
        <button onClick={() => router.push('/dashboard')} className="bg-blue-600 text-white px-6 py-2 rounded-lg mt-4">Kembali</button>
      </div>
    </div>
  )

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'zone', label: 'ZOne', icon: '🔷' },
    { key: 'zgold', label: 'ZGold', icon: '💰' },
    { key: 'zbengkel', label: 'ZBengkel', icon: '🔧' },
    { key: 'zlaundry', label: 'ZLaundry', icon: '🧺' },
    { key: 'zface', label: 'ZFace', icon: '📷' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  const allUsers = tab === 'zone' ? zoneUsers : crossUsers
  const filtered = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 pt-safe">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">←</button>
          <h1 className="font-bold text-white">⚙️ Admin Panel</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 pb-24">
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 cursor-pointer" onClick={() => setError('')}>{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3 mb-4 cursor-pointer" onClick={() => setSuccess('')}>{success}</div>}

        {/* App tabs */}
        <div className="flex gap-1 mb-5 bg-slate-800/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setError(''); setSuccess(''); setSearch('') }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg transition ${tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {tab === 'settings' ? (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">🌐 Z-Apps</h3>
              <div className="space-y-2 text-sm">
                {Object.entries({ ZOne: 'zone-production-0099.up.railway.app', ZGold: 'zgold-production.up.railway.app', ZBengkel: 'zbengkel-production.up.railway.app', ZLaundry: 'zlaundry-production.up.railway.app', ZFace: 'zface.zomet.my.id' }).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-slate-400">{k}</span>
                    <a href={`https://${v}`} target="_blank" rel="noopener" className="text-blue-400 text-xs">{v} →</a>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">📊 Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Stack</span><span className="text-white">Next.js + PostgreSQL</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Auth</span><span className="text-white">NextAuth v5 (JWT)</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Face Recognition</span><span className="text-white">ZFace (InsightFace)</span></div>
              </div>
            </div>
          </div>
        ) : tab === 'zface' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-white">{allUsers.length}</div>
                <div className="text-[10px] text-slate-400">Wajah</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-green-400">{(allUsers as any[]).reduce((s: number, u: any) => s + (u.faces || 0), 0)}</div>
                <div className="text-[10px] text-slate-400">Total Foto</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{(allUsers as any[]).filter(u => (u.faces || 0) > 1).length}</div>
                <div className="text-[10px] text-slate-400">Multi</div>
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <input type="text" placeholder="Cari wajah..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              </div>
            </div>

            {/* Face list */}
            {crossLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-400 mt-3">Loading data dari ZFace...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(filtered as any[]).map((person, i) => (
                  <div key={i} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-lg">
                        📷
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm">{person.name}</div>
                        <div className="text-xs text-slate-400">{person.faces} foto wajah</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(person.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-8">Belum ada wajah terdaftar</div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ZLaundry Plan Info */}
            {tab === 'zlaundry' && (crossExtra as any)?.plan && (
              <div className="mb-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Current Plan</h4>
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{(crossExtra as any).plan.info?.name || 'Free'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      (crossExtra as any).plan.current === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {(crossExtra as any).plan.current?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {((crossExtra as any).plan.available || []).map((p: any) => (
                      <button key={p.id} onClick={() => {
                        handleCrossPlanAction(p.id, p.id, undefined)
                      }}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                          (crossExtra as any).plan.current === p.id ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                        }`}>
                        {p.name} {p.hargaBulan > 0 ? `Rp${(p.hargaBulan/1000).toFixed(0)}rb/bln` : 'Gratis'}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Max: {(crossExtra as any).plan.info?.maxOrder === -1 ? '∞' : (crossExtra as any).plan.info?.maxOrder} pesanan · {(crossExtra as any).plan.info?.maxCustomer === -1 ? '∞' : (crossExtra as any).plan.info?.maxCustomer} pelanggan · {(crossExtra as any).plan.info?.maxUser === -1 ? '∞' : (crossExtra as any).plan.info?.maxUser} user
                  </div>
                </div>
              </div>
            )}

            {/* Tenant Plans (ZGold, ZBengkel, ZLaundry) */}
            {tab === 'zgold' || tab === 'zbengkel' || tab === 'zlaundry' ? (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Tenant Plans</h4>
                  <button onClick={handleCreateTenant} className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">+ Tambah Tenant</button>
                </div>
                {(crossExtra as any)?.tenants && (crossExtra as any).tenants.length > 0 ? (
                  <div className="space-y-2">
                  {(crossExtra as any).tenants.map((t: any) => (
                    <div key={t.tenantId || t.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-white text-sm font-medium">{t.tenantName || t.namaToko}</span>
                          <span className="text-slate-500 text-xs ml-2">/{t.slug}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          (t.plan || 'free') === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                          (t.plan || 'free') === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                          (t.plan || 'free') === 'basic' ? 'bg-green-500/20 text-green-300' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {(t.plan || 'free').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {['free', 'basic', 'pro', 'enterprise'].map(p => (
                          <button key={p} onClick={() => {
                            const expires = prompt(`Tanggal expiry (YYYY-MM-DD) untuk plan ${p.toUpperCase()}:\nKosongkan untuk default 30 hari:`)
                            handleCrossPlanAction(t.tenantId || t.id, p, expires || undefined)
                          }}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                              (t.plan || 'free') === p ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                            }`}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                      {t.planExpires && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Expired: {new Date(t.planExpires).toLocaleDateString('id-ID')}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => {
                          const newNama = prompt('Nama baru:', t.tenantName || t.namaToko)
                          if (newNama) handleTenantAction('updateTenant', { tenantId: t.tenantId || t.id, namaToko: newNama })
                        }} className="text-[10px] px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:border-slate-500">
                          ✏️ Edit
                        </button>
                        <button onClick={() => {
                          if (confirm(`Hapus tenant "${t.tenantName || t.namaToko}"? Semua user di tenant ini juga akan dihapus!`)) {
                            handleTenantAction('deleteTenant', { tenantId: t.tenantId || t.id })
                          }
                        }} className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                          🗑️ Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 text-sm py-4">Belum ada tenant</div>
              )}
            </div>
          ) : null}

            {/* ZFace — Tenant Plans */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Tenant Plans</h4>
                <button onClick={async () => {
                  const name = prompt('Nama Tenant:')
                  if (!name) return
                  const res = await fetch('/api/admin/cross-app', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ app: 'zface', action: 'createTenant', data: { name } }),
                  })
                  if (res.ok) { setSuccess('Tenant dibuat!'); fetchCrossUsers('zface') }
                  else { setError('Gagal buat tenant') }
                }} className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">+ Tambah Tenant</button>
              </div>
              {(crossExtra as any)?.tenants && (crossExtra as any).tenants.length > 0 ? (
                <div className="space-y-2">
                  {(crossExtra as any).tenants.map((t: any) => (
                    <div key={t.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-white text-sm font-medium">{t.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                          t.plan === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {t.plan?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {['starter', 'pro', 'enterprise'].map(p => (
                          <button key={p} onClick={() => {
                            const expires = prompt(`Tanggal expiry untuk plan ${p.toUpperCase()}:\nKosongkan untuk default 30 hari:`)
                            handleCrossPlanAction(t.id, p, expires || undefined)
                          }}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                              t.plan === p ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                            }`}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Quota: {t.quota || 'Unlimited'} wajah · {t.expires_at ? `Exp: ${new Date(t.expires_at).toLocaleDateString('id-ID')}` : 'Active'}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={async () => {
                          if (confirm(`Hapus tenant "${t.name}"? Semua wajah di tenant ini juga akan dihapus!`)) {
                            await fetch('/api/admin/cross-app', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ app: 'zface', action: 'deleteTenant', data: { tenantId: t.id } }),
                            })
                            setSuccess('Tenant dihapus')
                            fetchCrossUsers('zface')
                          }
                        }} className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                          🗑️ Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 text-sm py-4">Belum ada tenant</div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-white">{allUsers.length}</div>
                <div className="text-[10px] text-slate-400">Total</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-green-400">{allUsers.filter(u => u.faceId).length}</div>
                <div className="text-[10px] text-slate-400">📷 Wajah</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{allUsers.filter(u => u.role?.toLowerCase() === 'admin' || u.role === 'ADMIN' || u.role === 'owner').length}</div>
                <div className="text-[10px] text-slate-400">Admin</div>
              </div>
            </div>

            {/* Search + Add button */}
            <div className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <input type="text" placeholder="Cari user..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              </div>
              <button onClick={() => tab === 'zone' ? setShowAddUser(true) : setShowCrossAdd(true)}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-3 rounded-xl active:scale-95 transition">
                + Tambah
              </button>
            </div>

            {/* User list */}
            {crossLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-400 mt-3">Loading users dari {tab.toUpperCase()}...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(user => (
                  <div key={user.id || user.email} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm">{user.name}</span>
                          {user.faceId && <span className="text-xs">📷</span>}
                          {(user.role === 'ADMIN' || user.role === 'owner') && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">ADMIN</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{user.email}</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {new Date(user.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tab === 'zone' ? (
                        <>
                          <button onClick={() => handleZoneAction('update-user', user.email, { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">
                            {user.role === 'ADMIN' ? '↓ USER' : '↑ ADMIN'}
                          </button>
                          {user.faceId && (
                            <button onClick={() => handleZoneAction('unlink-face', user.email)}
                              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              📷 Hapus Wajah
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {tab !== 'zgold' && (
                            <button onClick={() => handleAction(tab, 'updateRole', user.email, { role: user.role === 'ADMIN' ? 'KASIR' : 'ADMIN' })}
                              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">
                              {user.role === 'ADMIN' ? '↓ KASIR' : '↑ ADMIN'}
                            </button>
                          )}
                          {tab === 'zgold' && (
                            <button onClick={() => handleAction(tab, 'updateRole', user.email, { role: user.role === 'owner' ? 'kasir' : 'owner' })}
                              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">
                              {user.role === 'owner' ? '↓ kasir' : '↑ owner'}
                            </button>
                          )}
                          <button onClick={() => {
                            const np = prompt(`Password baru untuk ${user.email}:`)
                            if (np && np.length >= 6) handleAction(tab, 'resetPassword', user.email, { password: np })
                          }}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            🔑 Reset PW
                          </button>
                          <button onClick={() => handleCrossDelete(user.email, user.name)}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                            🗑️ Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-8">Tidak ada user</div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Add User Modal (ZOne) */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowAddUser(false)}>
          <div className="w-full sm:max-w-sm bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-5 pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Tambah User</h3>
              <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nama *</label>
                <input type="text" value={addName} required onChange={e => setAddName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
                <input type="email" value={addEmail} required onChange={e => setAddEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">No. HP</label>
                <input type="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Password *</label>
                <input type="password" value={addPassword} required minLength={6} onChange={e => setAddPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Role</label>
                <div className="flex gap-2">
                  {['USER', 'ADMIN'].map(r => (
                    <button key={r} type="button" onClick={() => setAddRole(r)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition ${addRole === r ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                      {r === 'ADMIN' ? '🔑 ADMIN' : '👤 USER'}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={addLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 mt-2 transition active:scale-[0.98]">
                {addLoading ? 'Mendaftarkan...' : '✓ Daftarkan User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal (Cross-app) */}
      {showCrossAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowCrossAdd(false)}>
          <div className="w-full sm:max-w-sm bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-5 pb-safe" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Tambah User ke {tab.toUpperCase()}</h3>
              <button onClick={() => setShowCrossAdd(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={handleCrossAddUser} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nama *</label>
                <input type="text" value={crossAppName} required onChange={e => setCrossAppName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
                <input type="email" value={crossAppEmail} required onChange={e => setCrossAppEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">No. HP</label>
                <input type="tel" value={crossAppPhone} onChange={e => setCrossAppPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Password *</label>
                <input type="password" value={crossAppPassword} required minLength={6} onChange={e => setCrossAppPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Role</label>
                <div className="flex gap-2">
                  {[
                    { key: '', label: 'Default' },
                    ...(tab === 'zgold' ? [{ key: 'kasir', label: 'Kasir' }, { key: 'owner', label: 'Owner' }] :
                      tab === 'zbengkel' ? [{ key: 'KASIR', label: 'Kasir' }, { key: 'ADMIN', label: 'Admin' }, { key: 'MEKANIK', label: 'Mekanik' }] :
                      [{ key: 'KASIR', label: 'Kasir' }, { key: 'ADMIN', label: 'Admin' }]),
                  ].map(r => (
                    <button key={r.key} type="button" onClick={() => setCrossAppRole(r.key)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${crossAppRole === r.key ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={crossAppLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 mt-2 transition active:scale-[0.98]">
                {crossAppLoading ? 'Menambahkan...' : '✓ Tambah ke ' + tab.toUpperCase()}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
