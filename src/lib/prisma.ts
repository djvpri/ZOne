import { PrismaClient } from '@prisma/client'
import { generateReferralCode } from './referral-code'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const basePrisma = globalForPrisma.prisma || new PrismaClient()

// Default untuk affiliate yang dibuat OTOMATIS saat user baru daftar.
// Beda dari mitra lapangan yang didaftarkan manual oleh admin (biasanya
// rate lebih tinggi karena effort aktif jualan) -- ini semacam "referral
// pasif" bawaan tiap akun, rate-nya sengaja lebih rendah.
const AUTO_AFFILIATE_TYPE = 'CUSTOMER_REFERRAL'
const AUTO_AFFILIATE_RATE = 50

async function ensureAffiliatePartner(userId: string, seed: string) {
  // Retry beberapa kali kalau referralCode-nya kebetulan bentrok (unique
  // constraint) -- kemungkinannya kecil tapi bukan nol.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await basePrisma.affiliatePartner.create({
        data: {
          userId,
          name: seed,
          type: AUTO_AFFILIATE_TYPE as any,
          referralCode: generateReferralCode(seed),
          commissionRate: AUTO_AFFILIATE_RATE,
        },
      })
      return
    } catch (e: any) {
      // P2002 = unique constraint violation. Kalau itu gara-gara userId
      // (affiliate buat user ini udah ada), aman diabaikan. Kalau gara-gara
      // referralCode bentrok, coba lagi dengan kode baru.
      if (e?.code === 'P2002') continue
      console.error('[auto-affiliate] gagal bikin affiliate partner:', e)
      return
    }
  }
  console.error('[auto-affiliate] gagal generate referralCode unik setelah 5x percobaan untuk user', userId)
}

function buildPrismaClient() {
  return basePrisma.$extends({
    query: {
      user: {
        async create({ args, query }: any) {
          const result = await query(args)
          await ensureAffiliatePartner(result.id, result.name || result.email)
          return result
        },
      },
    },
  })
}

export const prisma = (globalForPrisma.prisma as any) || buildPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as any

