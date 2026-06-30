// Provision akun demo: bisa akses SEMUA app sebagai admin, di tenant sandbox.
//
// Untuk tiap app aktif:
//   1. Pastikan ada tenant "Demo" (sandbox) — createTenant kalau belum ada.
//   2. Pastikan user demo ada DI tenant Demo itu (create / moveTenant).
//   3. Set role demo = admin (best-effort; nama role tiap app bisa beda).
//   4. Hub: UserApp link aktif (biar muncul di dashboard & SSO diizinkan).
//
// KEAMANAN: kalau tenant Demo sandbox TIDAK bisa dibuat/ditemukan untuk suatu
// app, demo TIDAK di-admin-kan di app itu (biar pengunjung publik tak pegang
// data toko asli). Link hub tetap dibuat supaya app tampil di dashboard.
//
// Kontrak cross-app tiap spoke beda-beda, jadi payload dikirim SUPERSET
// (name+namaToko+slug dst) supaya tiap spoke ambil yang ia perlu. Best-effort:
// hasil per-app dilaporkan; yang gagal perlu dirapikan manual / samakan kontrak.
//
// Jalankan di container Z One (butuh DATABASE_URL + CROSS_APP_SECRET):
//   node scripts/provision-demo-admin.js
// Idempotent: aman dijalankan berulang.

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { randomBytes } = require('crypto')

const p = new PrismaClient()
const SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'
const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@zomet.my.id').toLowerCase()
const DEMO_NAME = 'Demo'
const DEMO_PASS = process.env.DEMO_PASSWORD || 'demo-zomet-2026'

// App "ownership-based": user TIDAK di dalam tenant, tapi MEMILIKI entitas
// (mis. Z-Rooms: Properti.ownerId). Sandbox demo = USER yang memiliki entitas
// "Demo" (bukan ADMIN global, karena ADMIN di app ini = operator SaaS).
// createTenant app ini menerima ownerEmail untuk set pemiliknya.
const OWNERSHIP_BASED = new Set(['zrooms', 'z-rooms'])

const norm = (s) => (s == null ? '' : String(s))
const tId = (t) => norm(t.id || t.tenantId)
const tName = (t) => norm(t.name || t.tenantName || t.namaToko)
const uTenant = (u) => norm(u.tenantId || u.tenant_id)

async function spokeGet(base) {
  const res = await fetch(`${base}/api/admin/cross-app`, { headers: { Authorization: `Bearer ${SECRET}` } })
  if (!res.ok) throw new Error(`GET ${res.status}`)
  return res.json()
}
async function spokePost(base, body) {
  const res = await fetch(`${base}/api/admin/cross-app`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json = {}
  try { json = await res.json() } catch {}
  return { ok: res.ok, status: res.status, json }
}

async function ensureHubDemo() {
  let u = await p.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!u) {
    u = await p.user.create({
      data: { name: DEMO_NAME, email: DEMO_EMAIL, password: await bcrypt.hash(randomBytes(12).toString('hex'), 10), role: 'USER' },
    })
  }
  return u
}

async function main() {
  const demoHub = await ensureHubDemo()
  const apps = await p.app.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })

  for (const app of apps) {
    const tag = app.slug
    if (!app.url || app.url === '#') { console.log('—', tag, '(tanpa url, dilewati)'); continue }
    const base = app.url.trim().replace(/\/+$/, '')

    // Link hub dulu (biar app muncul di dashboard demo), apa pun hasil spoke-nya
    await p.userApp.upsert({
      where: { userId_appId: { userId: demoHub.id, appId: app.id } },
      update: { active: true },
      create: { userId: demoHub.id, appId: app.id, active: true },
    }).catch(() => {})

    let data
    try { data = await spokeGet(base) } catch (e) { console.log('✗', tag, '- spoke tak terjangkau:', e.message); continue }
    const tenants = data.tenants || []
    const users = data.users || []

    // App berbasis kepemilikan (mis. Z-Rooms): demo = USER yang MEMILIKI entitas
    // "Demo". Tak ada tenant-scoping user -> tak pakai moveTenant/admin global.
    if (OWNERSHIP_BASED.has(app.slug)) {
      const demoUser = users.find((u) => norm(u.email).toLowerCase() === DEMO_EMAIL)
      if (!demoUser) {
        const rc = await spokePost(base, { action: 'create', data: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASS } })
        if (!rc.ok || rc.json.error) { console.log('⚠', tag, '- buat user demo gagal:', rc.json.error || rc.status); continue }
      }
      const rp = await spokePost(base, { action: 'createTenant', data: { name: DEMO_NAME, ownerEmail: DEMO_EMAIL } })
      if (rp.ok && !rp.json.error) console.log('✓', tag, '- demo = pemilik "Demo" (USER, sandbox kepemilikan)')
      else console.log('⚠', tag, '- buat entitas Demo milik demo gagal:', (rp.json.error || rp.status))
      continue
    }

    // 1) Tenant Demo (sandbox)
    let demoTenant = tenants.find((t) => tName(t).toLowerCase() === 'demo')
    if (!demoTenant) {
      const r = await spokePost(base, { action: 'createTenant', data: { name: DEMO_NAME, namaToko: DEMO_NAME, slug: 'demo' } })
      if (r.ok && r.json.tenant) demoTenant = r.json.tenant
      else { console.log('⚠', tag, '- tenant Demo gagal dibuat (', (r.json.error || r.status), ') -> demo TIDAK di-admin-kan di sini'); continue }
    }
    const demoTenantId = tId(demoTenant)

    // 2) User demo harus ADA & di tenant Demo
    let demoUser = users.find((u) => norm(u.email).toLowerCase() === DEMO_EMAIL)
    if (!demoUser) {
      const r = await spokePost(base, { action: 'create', data: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASS, tenantId: demoTenantId } })
      if (!r.ok || r.json.error) { console.log('⚠', tag, '- buat user demo gagal:', r.json.error || r.status); continue }
    } else if (demoTenantId && uTenant(demoUser) !== demoTenantId) {
      // pindahkan ke tenant Demo; kalau gagal, jangan di-admin-kan (biar tak pegang tenant asli)
      const mv = await spokePost(base, { action: 'moveTenant', email: DEMO_EMAIL, data: { userId: demoUser.id, email: DEMO_EMAIL, tenantId: demoTenantId } })
      if (!mv.ok || mv.json.error) { console.log('⚠', tag, '- demo ada di tenant lain & gagal dipindah (', (mv.json.error || mv.status), ') -> role TIDAK diubah demi keamanan'); continue }
    }

    // 3) Role admin (best-effort)
    const rr = await spokePost(base, { action: 'updateRole', email: DEMO_EMAIL, data: { role: 'admin' } })
    if (rr.ok && !rr.json.error) console.log('✓', tag, '- demo = admin @ tenant Demo')
    else console.log('◑', tag, '- di tenant Demo, tapi set role admin gagal (', (rr.json.error || rr.status), ') -> cek role yg didukung app ini')
  }

  console.log('\nSelesai. Cek hasil per-app di atas. ✓=admin siap, ◑=user ada tapi role belum admin, ⚠=dilewati demi keamanan.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
