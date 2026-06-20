const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const APPS = [
  { slug: 'zgold', name: 'ZGold', description: 'POS Toko Emas — multi logam mulia', icon: '💎', url: 'https://zgold-production.up.railway.app', color: '#eab308', category: 'pos', order: 1 },
  { slug: 'zbengkel', name: 'ZBengkel', description: 'POS Bengkel — motor, mobil, alat berat', icon: '🔧', url: 'https://zbengkel-production.up.railway.app', color: '#f97316', category: 'pos', order: 2 },
  { slug: 'zlaundry', name: 'ZLaundry', description: 'POS Laundry — per-kg & satuan', icon: '🧺', url: 'https://zlaundry-production.up.railway.app', color: '#2563eb', category: 'pos', order: 3 },
  { slug: 'zresto', name: 'Z-Resto', description: 'POS Restoran — table management & delivery', icon: '🍽️', url: '#', color: '#ef4444', category: 'pos', order: 4 },
  { slug: 'zabsen', name: 'Z-Absen', description: 'Sistem Absensi — face recognition & GPS', icon: '📋', url: '#', color: '#8b5cf6', category: 'hr', order: 10 },
  { slug: 'zrooms', name: 'Z-Rooms', description: 'Booking Ruangan — meeting room & co-working', icon: '🏠', url: '#', color: '#06b6d4', category: 'booking', order: 11 },
  { slug: 'zbanker', name: 'Z-Banker', description: 'Keuangan Pribadi — tabungan & investasi', icon: '🏦', url: '#', color: '#10b981', category: 'finance', order: 20 },
  { slug: 'ztrader', name: 'Z-Trader', description: 'Trading Dashboard — XAUUSD & analisis', icon: '📈', url: '#', color: '#f59e0b', category: 'finance', order: 21 },
  { slug: 'zface', name: 'Z-Face', description: 'Face Recognition — identifikasi wajah', icon: '🔐', url: '#', color: '#6366f1', category: 'identity', order: 30 },
  { slug: 'zanalytics', name: 'Z-Analytics', description: 'Business Intelligence — dashboard & laporan', icon: '📊', url: '#', color: '#14b8a6', category: 'analytics', order: 40 },
  { slug: 'zmedics', name: 'Z-Medics', description: 'Kesehatan — rekam medis & konsultasi', icon: '🏥', url: '#', color: '#ec4899', category: 'health', order: 50 },
  { slug: 'zomet', name: 'Zomet', description: 'Platform bisnis & manajemen', icon: '🚀', url: '#', color: '#8b5cf6', category: 'platform', order: 60 },
]

async function main() {
  console.log('🌱 Seeding Z One database...')

  // Create apps
  for (const app of APPS) {
    await prisma.app.upsert({
      where: { slug: app.slug },
      update: app,
      create: app,
    })
  }
  console.log(`  ✓ ${APPS.length} apps registered`)

  // Create admin user
  const hash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@zone.id' },
    update: {},
    create: {
      name: 'Andi Admin',
      email: 'admin@zone.id',
      password: hash,
      role: 'ADMIN',
      plan: 'ENTERPRISE',
    },
  })
  console.log(`  ✓ Admin: admin@zone.id / admin123`)

  // Create demo user
  const demoHash = await bcrypt.hash('user123', 10)
  const demo = await prisma.user.upsert({
    where: { email: 'user@zone.id' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'user@zone.id',
      password: demoHash,
      role: 'USER',
      plan: 'FREE',
    },
  })
  console.log(`  ✓ Demo: user@zone.id / user123`)

  // Link admin to all apps
  const allApps = await prisma.app.findMany()
  for (const app of allApps) {
    await prisma.userApp.upsert({
      where: { userId_appId: { userId: admin.id, appId: app.id } },
      update: { active: true },
      create: { userId: admin.id, appId: app.id, active: true },
    })
  }
  console.log(`  ✓ Admin linked to all apps`)

  // Link demo to ZLaundry
  const zlaundry = allApps.find(a => a.slug === 'zlaundry')
  if (zlaundry) {
    await prisma.userApp.upsert({
      where: { userId_appId: { userId: demo.id, appId: zlaundry.id } },
      update: { active: true },
      create: { userId: demo.id, appId: zlaundry.id, active: true },
    })
    console.log(`  ✓ Demo linked to ZLaundry`)
  }

  console.log('✅ Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
