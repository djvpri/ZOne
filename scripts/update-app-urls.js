// scripts/update-app-urls.js — jalankan sekali via: node scripts/update-app-urls.js
// Update all deployed app URLs in ZOne database

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const URLS = {
  zgold: 'https://zgold.zomet.my.id',
  zbengkel: 'https://zbengkel.zomet.my.id',
  zlaundry: 'https://zlaundry.zomet.my.id',
  zprint: 'https://zprint.zomet.my.id',
  zrooms: 'https://z-rooms.zomet.my.id',
  zbilliar: 'https://zbilliar.zomet.my.id',
  ztrans: 'https://ztrans.zomet.my.id',
  zpos: 'https://zpos.zomet.my.id',
  zmedics: 'https://zmedics.zomet.my.id',
  zface: 'https://zface.zomet.my.id',
  zabsen: 'https://zabsen.zomet.my.id',
  zwisata: 'https://zwisata.zomet.my.id',
  zgym: 'https://zgym.zomet.my.id',
  zresto: 'https://zresto.zomet.my.id',
}

async function main() {
  console.log('Updating app URLs...')
  for (const [slug, url] of Object.entries(URLS)) {
    try {
      const app = await prisma.app.update({
        where: { slug },
        data: { url },
      })
      console.log(`✅ ${slug} → ${url}`)
    } catch (e) {
      console.log(`❌ ${slug}: ${e.message}`)
    }
  }
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
