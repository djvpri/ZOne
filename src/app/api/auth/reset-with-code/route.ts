import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/reset-with-code   { email, code, newPassword }
 * Dipakai halaman /reset oleh user yang tidak bisa login (lupa password).
 * Kode dibuat admin lewat /manage, berlaku 15 menit, sekali pakai.
 */
const hash = (code: string) => createHash('sha256').update(code).digest('hex')

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').toLowerCase().trim()
  const code = String(body.code || '').trim()
  const newPassword = String(body.newPassword || '')

  if (!email || !code) {
    return NextResponse.json({ error: 'Email dan kode wajib diisi' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, "userId", email, "usedAt", "expiresAt" FROM "PasswordReset" WHERE "codeHash" = $1 LIMIT 1`,
    hash(code)
  )
  const row = rows?.[0]
  // pesan sengaja umum: jangan beri tahu apakah email terdaftar atau kode salah
  const invalid = NextResponse.json({ error: 'Kode tidak valid atau sudah kedaluwarsa' }, { status: 400 })

  if (!row) return invalid
  if (row.usedAt) return invalid
  if (new Date(row.expiresAt) < new Date()) return invalid
  if (String(row.email).toLowerCase() !== email) return invalid

  const user = await prisma.user.findUnique({ where: { id: row.userId } })
  if (!user) return invalid

  // Kode dibakar lebih dulu (atomik) supaya dua permintaan bersamaan tidak
  // bisa memakai kode yang sama dua kali.
  const claimed = await prisma.$executeRawUnsafe(
    `UPDATE "PasswordReset" SET "usedAt" = now() WHERE id = $1 AND "usedAt" IS NULL`,
    row.id
  )
  if (!claimed) return invalid

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  })

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "Session" WHERE "userId" = $1`, user.id)
  } catch { /* strategi JWT: tidak ada tabel sesi */ }

  return NextResponse.json({ ok: true, email })
}
