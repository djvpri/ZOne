const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// REMEDIASI SATU KALI — jalankan manual, bukan bagian dari start/migrate.
//
// seed-apps.js versi lama (sebelum diperbaiki) diam-diam menautkan SEMUA
// app ke SEMUA user dengan active=true setiap kali dijalankan — bertentangan
// dengan desain yang tertulis di API user-apps ("satu user bisa jadi member
// di beberapa app, TIDAK otomatis dapat akses ke semua app"). Akibatnya
// semua user di ekosistem sempat punya akses SSO ke semua app (termasuk
// ZFace/wajah, Z-Medics/rekam medis, ZGold/finansial).
//
// Script ini menonaktifkan (BUKAN menghapus) semua baris UserApp — reversibel
// kapan saja lewat /manage > Akses User. Setelah dijalankan, setiap user akan
// kehilangan akses SSO ke semua app sampai admin menyalakan kembali secara
// sadar per user per app.
async function revoke() {
  const before = await p.userApp.count({ where: { active: true } })
  const result = await p.userApp.updateMany({ where: { active: true }, data: { active: false } })
  console.log(`Dinonaktifkan: ${result.count} dari ${before} akses aktif.`)
  console.log('Semua user sekarang TIDAK punya akses ke app manapun.')
  console.log('Nyalakan kembali secara sadar lewat /manage > Akses User.')
}

revoke().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
