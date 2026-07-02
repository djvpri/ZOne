// Update rate SEMUA AffiliatePartner yang sudah ada jadi 50%.
// Idempotent -- aman dijalankan berulang (cuma set ulang ke nilai yang sama
// kalau dijalankan lagi).
//
// Jalankan di environment yang punya DATABASE_URL:
//   node scripts/set-all-rates-50.js

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const NEW_RATE = 50

async function main() {
  const result = await prisma.affiliatePartner.updateMany({
    data: { commissionRate: NEW_RATE },
  })
  console.log(`Rate di-update ke ${NEW_RATE}% untuk ${result.count} affiliate partner.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
