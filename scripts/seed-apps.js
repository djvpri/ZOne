const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const APPS = [
  { slug: 'zpos', name: 'ZPos', description: 'Sistem kasir modern', icon: 'shop', url: 'https://zpos.zomet.my.id', color: '#2563eb', category: 'pos', order: 0 },
  { slug: 'zgold', name: 'ZGold', description: 'POS toko perhiasan', icon: 'gem', url: 'https://zgold.zomet.my.id', color: '#d97706', category: 'pos', order: 1 },
  { slug: 'zresto', name: 'Z-Resto', description: 'Manajemen restoran', icon: 'cup-hot', url: 'https://zresto.zomet.my.id', color: '#059669', category: 'pos', order: 2 },
  { slug: 'zbengkel', name: 'ZBengkel', description: 'Manajemen bengkel', icon: 'wrench-adjustable', url: 'https://zbengkel.zomet.my.id', color: '#dc2626', category: 'service', order: 3 },
  { slug: 'zmedics', name: 'Z-Medics', description: 'Rekam medis digital', icon: 'heart-pulse', url: 'https://zmedics.zomet.my.id', color: '#7c3aed', category: 'health', order: 4 },
  { slug: 'zrooms', name: 'Z-Rooms', description: 'Manajemen properti', icon: 'house-door', url: 'https://z-rooms.zomet.my.id', color: '#0891b2', category: 'property', order: 5 },
  { slug: 'zabsen', name: 'Z-Absen', description: 'Absensi digital', icon: 'clipboard-check', url: 'https://z-absen.zomet.my.id', color: '#65a30d', category: 'hr', order: 6 },
  { slug: 'zface', name: 'Z-Face', description: 'Pengenalan wajah', icon: 'person-bounding-box', url: 'https://zface.zomet.my.id', color: '#9333ea', category: 'ai', order: 7 },
  { slug: 'zlaundry', name: 'ZLaundry', description: 'POS laundry', icon: 'basket3', url: 'https://zlaundry.zomet.my.id', color: '#0284c7', category: 'pos', order: 8 },
  { slug: 'ztrans', name: 'Z-Trans', description: 'Tiket & manajemen bus', icon: 'bus-front', url: 'https://ztrans.zomet.my.id', color: '#f5a524', category: 'pos', order: 9 },
]

async function seed() {
  console.log('Seeding apps...')
  for (const app of APPS) {
    await p.app.upsert({
      where: { slug: app.slug },
      update: app,
      create: app,
    })
    console.log('✓', app.slug)
  }

  // Link semua app ke semua user
  const users = await p.user.findMany({ select: { id: true } })
  const apps = await p.app.findMany({ select: { id: true } })
  for (const user of users) {
    for (const app of apps) {
      await p.userApp.upsert({
        where: { userId_appId: { userId: user.id, appId: app.id } },
        update: {},
        create: { userId: user.id, appId: app.id, active: true },
      }).catch(() => {})
    }
  }
  console.log('Linked', users.length, 'users to', apps.length, 'apps ✓')
}

seed().catch(e => console.error(e)).finally(() => p.$disconnect())
