'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

interface Tenant {
  id: string; name: string; plan?: string; active?: boolean; expires_at?: string | null; quota?: number
}
interface AppUser {
  id?: string; name: string; email?: string; faces?: number; linked_email?: string | null; tenantId?: string | null; active?: boolean; role?: string
}

interface AppRow {
  id: string; slug: string; name: string; icon?: string | null; url: string; isActive: boolean; category?: string
}

const APP_ROLES: Record<string, string[]> = {
  zpos:    ['kasir', 'owner', 'admin'],
  zresto:  ['CASHIER', 'OWNER', 'MANAGER', 'ADMIN'],
  zgold:   ['kasir', 'owner', 'admin'],
  zbengkel:['kasir', 'owner', 'admin'],
  zlaundry:['kasir', 'owner', 'admin'],
  zrooms:  ['USER', 'ADMIN', 'MANAGER'],
}

const PLANS = ['starter', 'pro', 'enterprise']

interface ZoneUser {
  id: string; name: string; email: string; role: string
  appLinks: { appId: string; active: boolean }[]
  faceId?: string | null
}

interface FaceEntry {
  faceId: string; name: string; faces?: number
  linked_email?: string | null; linked_to_zone: boolean
}

export default function ManageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [view, setView] = useState<'apps' | 'access'>('apps')
  const [zoneUsers, setZoneUsers] = useState<ZoneUser[]>([])
  const [zoneUsersLoading, setZoneUsersLoading] = useState(false)
  const [accessSaving, setAccessSaving] = useState<string>('')
  const [faces, setFaces] = useState<FaceEntry[]>([])
  const [facesLoading, setFacesLoading] = useState(false)
  const [faceLinkSaving, setFaceLinkSaving] = useState('')
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

  const fetchFaceLinks = useCallback(async () => {
    setFacesLoading(true)
    try {
      const res = await fetch('/api/admin/face-link')
      const data = await res.json()
      if (res.ok) {
        setFaces(data.faces || [])
        setZoneUsers(prev => prev.map(u => {
          const linked = (data.zone_users || []).find((zu: any) => zu.id === u.id)
          return linked ? { ...u, faceId: linked.faceId } : u
        }))
      }
    } catch { setError('Gagal memuat data wajah ZFace') }
    finally { setFacesLoading(false) }
  }, [])

  const fetchZoneUsers = useCallback(async () => {
    setZoneUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok) setZoneUsers(data.users || [])
    } catch { setError('Gagal memuat daftar user ZOne') }
    finally { setZoneUsersLoading(false) }
  }, [])

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

  useEffect(() => {
    if (isAdmin && view === 'access') {
      fetchZoneUsers()
      fetchFaceLinks()
      if (apps.length === 0) fetchApps()
    }
  }, [isAdmin, view, fetchZoneUsers, fetchFaceLinks, apps.length, fetchApps])

  const handleFaceLink = async (userId: string, faceId: string | null) => {
    setFaceLinkSaving(faceId || userId)
    try {
      const res = await fetch('/api/admin/face-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, faceId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal')
      flash(faceId ? 'Wajah ditautkan ke akun Z One ✓' : 'Tautan wajah dilepas')
      fetchFaceLinks()
    } catch (err: any) { setError(err.message) }
    finally { setFaceLinkSaving('') }
  }

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const genPassword = () => Math.random().toString(36).slice(-5) + Math.random().toString(36).slice(-5).toUpperCase()

  const toggleAccess = async (userId: string, appId: string, nextActive: boolean) => {
    const key = `${userId}:${appId}`
    setAccessSaving(key)
    try {
      const res = await fetch('/api/admin/user-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, appId, active: nextActive }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal mengubah akses')
      setZoneUsers(prev => prev.map(u => {
        if (u.id !== userId) return u
        const has = u.appLinks.some(l => l.appId === appId)
        return {
          ...u,
          appLinks: has
            ? u.appLinks.map(l => l.appId === appId ? { ...l, active: nextActive } : l)
            : [...u.appLinks, { appId, active: nextActive }],
        }
      }))

      // Aktifkan akses -> sekalian buatkan akun login di app itu kalau belum ada
      if (nextActive) {
        const zUser = zoneUsers.find(u => u.id === userId)
        const app = apps.find(a => a.id === appId)
        if (zUser && app && app.url && app.url !== '#') {
          try {
            const checkRes = await fetch(`/api/admin/cross-app?app=${app.slug}`)
            const checkData = await checkRes.json()
            const already = (checkData.users || []).some((u: any) => u.email?.toLowerCase() === zUser.email.toLowerCase())
            if (!already) {
              const tempPassword = genPassword()
              const createRes = await fetch('/api/admin/cross-app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  app: app.slug, action: 'create',
                  data: { name: zUser.name, email: zUser.email, password: tempPassword },
                }),
              })
              const createResult = await createRes.json()
              if (createRes.ok && !createResult.error) {
                flash(`Akses diaktifkan + akun ${app.name} dibuat. Password sementara: ${tempPassword}`)
              } else {
                flash(`Akses diaktifkan, tapi akun ${app.name} gagal dibuat otomatis: ${createResult.error || 'unknown error'}`)
              }
            } else {
              flash(`Akses ${app.name} diaktifkan (akun sudah ada sebelumnya)`)
            }
          } catch {
            flash('Akses diaktifkan, tapi gagal cek/buat akun otomatis di app tujuan')
          }
        } else {
          flash('Akses diaktifkan')
        }
      } else {
        flash('Akses dimatikan')
      }
    } catch (err: any) { setError(err.message) }
    finally { setAccessSaving('') }
  }

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

      // Tiap app punya nama field sedikit beda (id/tenantId, name/namaToko, dst) —
      // normalisasi di sini biar sisa UI cukup pakai t.id / t.name / u.id dst.
      const normTenants: Tenant[] = (data.tenants || []).map((t: any) => ({
        id: String(t.id ?? t.tenantId ?? t.tenant_id),
        name: t.name ?? t.namaToko ?? t.nama ?? t.tenantName ?? '(tanpa nama)',
        plan: t.plan,
        active: t.active ?? t.aktif,
        expires_at: t.expires_at ?? t.expiresAt ?? t.langganan_sampai ?? null,
      }))
      const normUsers: AppUser[] = (data.users || []).map((u: any) => ({
        id: u.id != null ? String(u.id) : undefined,
        name: u.name ?? u.nama ?? '(tanpa nama)',
        email: u.email,
        faces: u.faces,
        linked_email: u.linked_email,
        tenantId: u.tenantId != null ? String(u.tenantId) : (u.tenant_id != null ? String(u.tenant_id) : null),
        active: u.active ?? u.aktif ?? u.isActive,
        role: u.role ?? u.jabatan ?? undefined,
      }))
      setUsers(normUsers)
      setTenants(normTenants)
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
      const name = newTenantName.trim()
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      // Kirim semua field yang mungkin dibutuhkan berbagai app
      await call('createTenant', { name, namaToko: name, slug, plan: 'starter' })
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
    if (!confirm(`Nonaktifkan tenant "${name}"?\nSemua user di tenant ini tidak akan bisa login, tapi bisa diaktifkan ulang kapan saja. Data tidak dihapus.`)) return
    try {
      await call('deleteTenant', { tenantId })
      flash(`Tenant "${name}" dinonaktifkan`)
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleReactivateTenant = async (tenantId: string, name: string) => {
    try {
      await call('reactivateTenant', { tenantId })
      flash(`Tenant "${name}" diaktifkan kembali`)
      fetchData(activeApp)
    } catch (err: any) { setError(`Gagal aktifkan ulang: ${err.message}`) }
  }

  const handleUpdateRole = async (email: string | undefined, name: string, newRole: string) => {
    if (!email) return
    try {
      await call('updateRole', { email, role: newRole }, email)
      flash(`Role "${name}" diubah ke ${newRole}`)
      fetchData(activeApp)
    } catch (err: any) { setError(`Gagal ubah role: ${err.message}`) }
  }

  const handleMoveUser = async (userId: string | undefined, email: string | undefined, name: string, newTenantId: string) => {
    if (!userId && !email) return
    try {
      await call('moveTenant', { userId, tenantId: newTenantId }, email)
      flash(`User "${name}" dipindah ke tenant baru`)
      fetchData(activeApp)
    } catch (err: any) { setError(`Gagal pindah tenant: ${err.message}`) }
  }

  const handleDeleteUser = async (email: string | undefined, name: string) => {
    if (!email) { setError(`User "${name}" tidak punya email, tidak bisa dihapus dari sini.`); return }
    if (!confirm(`Nonaktifkan user "${name}" (${email})?\nUser tidak akan bisa login lagi, tapi bisa diaktifkan ulang kapan saja.`)) return
    try {
      await call('delete', undefined, email)
      flash(`User "${name}" dinonaktifkan`)
      fetchData(activeApp)
    } catch (err: any) { setError(err.message) }
  }

  const handleReactivateUser = async (email: string | undefined, name: string) => {
    if (!email) return
    try {
      await call('reactivate', undefined, email)
      flash(`User "${name}" diaktifkan kembali`)
      fetchData(activeApp)
    } catch (err: any) { setError(`Gagal aktifkan ulang: ${err.message}`) }
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

        <div className="flex gap-1 mb-4 bg-slate-800/30 p-1 rounded-xl">
          <button onClick={() => setView('apps')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${view === 'apps' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            📦 Kelola Per-App
          </button>
          <button onClick={() => setView('access')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${view === 'access' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            🔐 Akses User
          </button>
        </div>

        {view === 'access' ? (
          <div>
            <p className="text-[11px] text-slate-500 mb-4">
              Atur app mana yang bisa dibuka tiap user dari dashboard Z One. Satu user bisa jadi member di beberapa app sekaligus, tanpa otomatis dapat akses ke app lain.
            </p>
            {zoneUsersLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : zoneUsers.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">Belum ada user ZOne</div>
            ) : (
              <div className="space-y-3">
                {zoneUsers.map(u => (
                  <div key={u.id} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                    <div className="mb-2.5">
                      <div className="text-white text-sm font-medium">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {apps.map(a => {
                        const link = u.appLinks.find(l => l.appId === a.id)
                        const isOn = !!link?.active
                        const key = `${u.id}:${a.id}`
                        return (
                          <button key={a.id}
                            disabled={accessSaving === key}
                            onClick={() => toggleAccess(u.id, a.id, !isOn)}
                            className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                              isOn ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}>
                            <span>{a.icon || '📦'}</span>{a.name}
                            {accessSaving === key ? '…' : (isOn ? ' ✓' : '')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section: Tautan Wajah ZFace ke Akun Z One */}
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">🔗 Tautan Wajah ZFace → Akun Z One</h4>
              <p className="text-[11px] text-slate-500 mb-4">
                Tautkan wajah yang terdaftar di ZFace ke akun Z One, supaya login wajah bisa berfungsi di semua app ekosistem.
              </p>
              {facesLoading ? (
                <div className="text-center py-6"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
              ) : faces.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-6">Belum ada wajah di ZFace</div>
              ) : (
                <div className="space-y-2">
                  {faces.map(f => {
                    const linkedUser = zoneUsers.find(u => u.faceId === f.faceId)
                    return (
                      <div key={f.faceId} className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-white text-sm font-medium">{f.name}</span>
                            {f.faces && <span className="text-[10px] text-slate-500 ml-2">{f.faces} foto</span>}
                            {f.linked_email && <div className="text-[11px] text-blue-400/80">🏢 {f.linked_email}</div>}
                          </div>
                          {f.linked_to_zone && linkedUser ? (
                            <span className="text-[10px] text-green-400">🔑 {linkedUser.name}</span>
                          ) : null}
                        </div>
                        {linkedUser ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-green-400">✓ Tertaut ke {linkedUser.email}</span>
                            <button
                              disabled={faceLinkSaving === linkedUser.id}
                              onClick={() => handleFaceLink(linkedUser.id, null)}
                              className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                              {faceLinkSaving === linkedUser.id ? '…' : 'Lepas'}
                            </button>
                          </div>
                        ) : (
                          <form className="flex gap-2" onSubmit={async e => {
                            e.preventDefault()
                            const sel = (e.currentTarget.elements.namedItem('userId') as HTMLSelectElement)
                            if (!sel.value) return
                            await handleFaceLink(sel.value, f.faceId)
                            sel.value = ''
                          }}>
                            <select
                              name="userId"
                              defaultValue=""
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                              <option value="">— Pilih akun Z One —</option>
                              {zoneUsers.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.email}){u.faceId ? ' ⚠️ sudah ada wajah' : ''}
                                </option>
                              ))}
                            </select>
                            <button type="submit"
                              disabled={!!faceLinkSaving && faceLinkSaving === f.faceId}
                              className="text-[10px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex-shrink-0">
                              {faceLinkSaving === f.faceId && faceLinkSaving ? '…' : 'Tautkan'}
                            </button>
                          </form>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="flex flex-wrap gap-1 mb-2 bg-slate-800/50 p-1 rounded-xl">
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
            <span className="text-slate-700">·</span>
            <select
              value={apps.find(a => a.slug === activeApp)?.category || 'general'}
              onChange={async e => {
                const app = apps.find(a => a.slug === activeApp)
                if (!app) return
                try {
                  const res = await fetch('/api/admin/apps', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: app.id, category: e.target.value }),
                  })
                  if (!res.ok) throw new Error((await res.json()).error || 'Gagal update')
                  flash('Kategori diperbarui')
                  fetchApps()
                } catch (err: any) { setError(err.message) }
              }}
              className="text-[10px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300"
            >
              <option value="general">📦 General</option>
              <option value="pos">🏪 Point of Sale</option>
              <option value="hr">👥 Human Resources</option>
              <option value="booking">📅 Booking & Reservasi</option>
              <option value="finance">💰 Keuangan & Investasi</option>
              <option value="identity">🔐 Identitas & Keamanan</option>
              <option value="analytics">📊 Analytics & BI</option>
              <option value="health">🏥 Kesehatan</option>
              <option value="platform">🚀 Platform</option>
            </select>
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
                    <div key={t.id} className={`bg-slate-900/80 border rounded-xl p-3 ${t.active === false ? 'border-slate-800 opacity-60' : 'border-slate-700/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium flex items-center gap-1.5">
                          {t.name}
                          {t.active === false && <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-full">nonaktif</span>}
                        </span>
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
                      {t.active === false ? (
                        <button onClick={() => handleReactivateTenant(t.id, t.name)}
                          className="text-[10px] px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">
                          ✅ Aktifkan Tenant
                        </button>
                      ) : (
                        <button onClick={() => handleDeleteTenant(t.id, t.name)}
                          className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                          🗑️ Nonaktifkan Tenant
                        </button>
                      )}
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
                  <div key={u.id || i} className={`bg-slate-900/80 border rounded-xl p-3 ${u.active === false ? 'border-slate-800 opacity-60' : 'border-slate-700/50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                          {u.name}
                          {u.active === false && <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-full flex-shrink-0">nonaktif</span>}
                          {u.role && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full flex-shrink-0">{u.role}</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{u.email || (u.linked_email ? `🔑 ${u.linked_email}` : 'belum ada email')}</div>
                        <div className="text-[10px] text-blue-400/80 truncate">
                          🏢 {u.tenantId ? (tenants.find(t => t.id === u.tenantId)?.name || 'Tenant tidak ditemukan') : 'Tanpa tenant'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {typeof u.faces === 'number' && <span className="text-[10px] text-slate-500">{u.faces} foto</span>}
                        {u.email && (
                          u.active === false ? (
                            <button onClick={() => handleReactivateUser(u.email, u.name)}
                              className="text-[10px] px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">
                              ✅ Aktifkan
                            </button>
                          ) : (
                            <button onClick={() => handleDeleteUser(u.email, u.name)}
                              className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                              🗑️ Nonaktifkan
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    {/* Ubah role */}
                    {APP_ROLES[activeApp]?.length > 0 && u.active !== false && u.email && (
                      <div className="flex gap-2 mt-2">
                        <select
                          value={u.role || ''}
                          onChange={async e => {
                            if (!e.target.value || e.target.value === u.role) return
                            await handleUpdateRole(u.email, u.name, e.target.value)
                          }}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-300">
                          <option value="">— Ubah role —</option>
                          {(APP_ROLES[activeApp] || []).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* Pindah tenant */}
                    {tenants.length > 1 && u.active !== false && (
                      <div className="flex gap-2 mt-2">
                        <select defaultValue={u.tenantId || ''}
                          onChange={async e => {
                            if (!e.target.value || e.target.value === u.tenantId) return
                            await handleMoveUser(u.id, u.email, u.name, e.target.value)
                          }}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-300">
                          <option value="">— Pindah ke tenant lain —</option>
                          {tenants.filter(t => t.id !== u.tenantId && t.active !== false).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ))}
        </>
        )}
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
                <button type="button" onClick={() => { setShowAddUser(false); setError('') }} className="flex-1 bg-slate-800 text-slate-300 text-sm font-semibold py-2.5 rounded-xl">Batal</button>
                <button type="submit" disabled={userLoading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  {userLoading ? '...' : 'Simpan'}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
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
