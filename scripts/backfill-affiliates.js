// Backfill: bikin AffiliatePartner buat user yang sudah terdaftar SEBELUM
// auto-create affiliate dipasang di src/lib/prisma.ts (lewat Prisma Client
// Extension pada query user.create). Extension itu cuma nyantol ke user
// BARU -- user lama perlu di-backfill sekali lewat script ini.
//
// Default yang dipakai sama persis dengan auto-create: tipe CUSTOMER_REFERRAL,
// rate 5%. Kalau mau beda per-user, edit manual lewat panel /affiliate
// setelah backfill jalan.
//
// Jalankan di environment yang punya DATABASE_URL:
//   node scripts/backfill-affiliates.js
// Idempotent: aman dijalankan berulang -- user yang udah punya affiliate
// (termasuk yang baru dibackfill) otomatis dilewati.

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const AUTO_AFFILIATE_TYPE = 'CUSTOMER_REFERRAL'
const AUTO_AFFILIATE_RATE = 50

function genCode(seed) {
  const base = (seed || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'USER'
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return base + suffix
}

async function main() {
  const users = await prisma.user.findMany({
    where: { affiliatePartner: null },
    select: { id: true, name: true, email: true },
  })
  console.log(`User tanpa affiliate: ${users.length}`)

  let ok = 0
  let gagal = 0

  for (const u of users) {
    let done = false
    for (let i = 0; i < 5 && !done; i++) {
      try {
        await prisma.affiliatePartner.create({
          data: {
            userId: u.id,
            name: u.name || u.email,
            type: AUTO_AFFILIATE_TYPE,
            referralCode: genCode(u.name || u.email),
            commissionRate: AUTO_AFFILIATE_RATE,
          },
        })
        done = true
        ok++
        console.log(`  OK: ${u.email}`)
      } catch (e) {
        if (e.code === 'P2002') continue // referralCode bentrok, coba lagi
        gagal++
        console.error(`  GAGAL: ${u.email} -- ${e.message}`)
        break
      }
    }
  }

  console.log(`Selesai. Berhasil: ${ok}, Gagal: ${gagal}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
