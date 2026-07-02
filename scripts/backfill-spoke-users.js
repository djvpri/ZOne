// Backfill: impor user yang sudah ada di tiap app spoke ke hub Z One.
// Untuk tiap app aktif, ambil daftar user lewat /api/admin/cross-app (Bearer
// CROSS_APP_SECRET), lalu buat akun hub (kalau belum ada) + aktifkan link app.
//
// Akun hub yang BARU dibuat diberi password ACAK (hash spoke tidak diekspos
// lewat cross-app), jadi user login hub via reset password / SSO / face. Akun
// hub yang SUDAH ada tidak diubah, hanya dipastikan punya link app aktif.
//
// Jalankan di environment yang punya DATABASE_URL + CROSS_APP_SECRET:
//   node scripts/backfill-spoke-users.js
// Idempotent: aman dijalankan berulang.

const { PrismaClient } = require('@prisma/client')

// Repo ini public — jangan pernah fallback ke secret hardcode.
function requireCrossAppSecret() {
  if (!process.env.CROSS_APP_SECRET) {
    console.error('CROSS_APP_SECRET belum di-set. Jalankan dengan env Railway.')
    process.exit(1)
  }
  return process.env.CROSS_APP_SECRET
}
const bcrypt = require('bcryptjs')
const { randomBytes } = require('crypto')

const p = new PrismaClient()
const SECRET = requireCrossAppSecret()

async function main() {
  const apps = await p.app.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  let created = 0, linked = 0, skipped = 0

  for (const app of apps) {
    if (!app.url || app.url === '#') { console.log('—', app.slug, '(tanpa url, dilewati)'); continue }
    const base = app.url.trim().replace(/\/+$/, '')

    let users = []
    try {
      const res = await fetch(`${base}/api/admin/cross-app`, { headers: { Authorization: `Bearer ${SECRET}` } })
      if (!res.ok) { console.log('✗', app.slug, 'balas', res.status); continue }
      users = (await res.json()).users || []
    } catch (e) {
      console.log('✗', app.slug, 'tidak terjangkau:', e.message)
      continue
    }

    for (const u of users) {
      const email = (u.email || '').trim()
      if (!email) { skipped++; continue }

      let hubUser = await p.user.findUnique({ where: { email } })
      if (!hubUser) {
        hubUser = await p.user.create({
          data: {
            name: u.name || email,
            email,
            password: await bcrypt.hash(randomBytes(12).toString('hex'), 10),
            role: 'USER',
          },
        })
        created++
      }

      await p.userApp.upsert({
        where: { userId_appId: { userId: hubUser.id, appId: app.id } },
        update: { active: true },
        create: { userId: hubUser.id, appId: app.id, active: true },
      })
      linked++
    }
    console.log('✓', app.slug, `(${users.length} user)`)
  }

  console.log(`\nSelesai. akun hub baru=${created}, link app=${linked}, dilewati(tanpa email)=${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
