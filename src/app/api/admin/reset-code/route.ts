import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomInt } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/reset-code      — admin membuat kode reset sekali pakai
 *   { email }  →  { code, expiresAt }
 *
 * Kode dipakai user di halaman /reset (tanpa perlu login), jadi admin bisa
 * mengirimkannya lewat WhatsApp tanpa butuh layanan email.
 */
const TTL_MINUTES = 15
const hash = (code: string) => createHash('sha256').update(code).digest('hex')

export async function POST(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').toLowerCase().trim()
  if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000)

  // kode lama untuk user ini dimatikan supaya tidak ada yang menggantung
  await prisma.$executeRawUnsafe(
    `DELETE FROM "PasswordReset" WHERE "userId" = $1 AND "usedAt" IS NULL`,
    user.id
  )
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PasswordReset" (id,"codeHash","userId",email,"expiresAt","createdBy") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5)`,
    hash(code),
    user.id,
    email,
    expiresAt,
    me?.email || null
  )

  console.log(`[reset-code] admin=${me?.email} -> ${email} berlaku ${TTL_MINUTES} menit`)

  return NextResponse.json({
    ok: true,
    email,
    code,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: TTL_MINUTES,
  })
}
