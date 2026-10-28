import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/reset-password
 * Admin mereset password user lain.
 *   { email, password? , mode: 'set' | 'generate' }
 * - mode 'set'      → admin mengetik password baru
 * - mode 'generate' → sistem membuat password sementara acak, dikembalikan SEKALI
 * Keduanya memasang mustChangePassword = true supaya user wajib menggantinya.
 */
function tempPassword() {
  // hindari karakter ambigu (0/O, 1/l/I) karena sering dikirim lewat WhatsApp
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join('')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').toLowerCase().trim()
  const mode = body.mode === 'generate' ? 'generate' : 'set'
  if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })

  let plain: string
  if (mode === 'generate') {
    plain = tempPassword()
  } else {
    plain = String(body.password || '')
    if (plain.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(plain, 10),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  })

  // Sesi yang masih hidup harus mati: kalau password diganti karena bocor,
  // penyerang tidak boleh tetap punya akses.
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Session" WHERE "userId" = $1`,
      user.id
    )
  } catch {
    /* tabel Session bisa tidak dipakai (JWT strategy) — abaikan */
  }

  console.log(`[reset-password] admin=${me?.email} -> ${email} mode=${mode}`)

  return NextResponse.json({
    ok: true,
    email,
    // password hanya dikembalikan sekali, untuk mode generate
    ...(mode === 'generate' ? { password: plain } : {}),
    mustChangePassword: true,
  })
}
