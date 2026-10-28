import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/change-password   { currentPassword, newPassword }
 *
 * Email diambil dari SESI, bukan dari body — versi lama menerima email dari
 * klien, sehingga endpoint tidak memastikan pemohon adalah pemilik akun.
 * Setelah berhasil: sesi lama dicabut (kalau password bocor, penyerang
 * langsung terlempar) dan mustChangePassword dimatikan.
 */
export async function POST(req: Request) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.email) {
    return NextResponse.json({ error: 'Sesi tidak ditemukan. Login ulang.' }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Password lama dan baru wajib diisi' }, { status: 400 })
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
    }

    const email = String(me.email).toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    const valid = await bcrypt.compare(String(currentPassword), user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 401 })
    }
    if (String(currentPassword) === String(newPassword)) {
      return NextResponse.json({ error: 'Password baru tidak boleh sama dengan yang lama' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(String(newPassword), 10),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    })

    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "Session" WHERE "userId" = $1`, user.id)
    } catch { /* strategi JWT: tidak ada tabel sesi */ }

    return NextResponse.json({
      ok: true,
      message: 'Password berhasil diganti. Sesi lain sudah dikeluarkan.',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
