import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// HP yang sudah login scan QR → tampil halaman konfirmasi → user tap "Izinkan"
// Endpoint ini dipanggil dari HP buat approve atau cancel QR session

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Harus login dulu di HP' }, { status: 401 })
  }

  try {
    const { token, action } = await req.json() // action: 'approve' | 'cancel'

    if (!token) return NextResponse.json({ error: 'token wajib diisi' }, { status: 400 })
    if (!['approve', 'cancel', 'scan'].includes(action)) {
      return NextResponse.json({ error: 'action tidak valid' }, { status: 400 })
    }

    const qr = await prisma.qrSession.findUnique({ where: { token } })
    if (!qr) return NextResponse.json({ error: 'QR tidak ditemukan' }, { status: 404 })
    if (qr.expiresAt < new Date()) return NextResponse.json({ error: 'QR sudah kedaluwarsa' }, { status: 410 })
    if (qr.status === 'APPROVED' || qr.status === 'CANCELLED') {
      return NextResponse.json({ error: 'QR sudah diproses' }, { status: 409 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

    if (action === 'scan') {
      // HP sudah scan — update status jadi SCANNED, kirim info user buat konfirmasi di HP
      await prisma.qrSession.update({
        where: { token },
        data: { status: 'SCANNED', userId: user.id, userEmail: user.email, userName: user.name, userRole: user.role },
      })
      return NextResponse.json({
        status: 'SCANNED',
        user: { name: user.name, email: user.email },
      })
    }

    if (action === 'approve') {
      await prisma.qrSession.update({
        where: { token },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role,
        },
      })
      return NextResponse.json({ status: 'APPROVED' })
    }

    if (action === 'cancel') {
      await prisma.qrSession.update({ where: { token }, data: { status: 'CANCELLED' } })
      return NextResponse.json({ status: 'CANCELLED' })
    }
  } catch (err) {
    console.error('QR approve error:', err)
    return NextResponse.json({ error: 'Gagal memproses QR' }, { status: 500 })
  }
}
