import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Desktop polling endpoint ini tiap 2 detik buat cek apakah QR sudah di-approve
// Kalau APPROVED, balikin info user supaya desktop bisa buat sesi login
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })

  try {
    const qr = await prisma.qrSession.findUnique({ where: { id } })

    if (!qr) return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 })

    // Cek apakah sudah expired
    if (qr.status === 'PENDING' && qr.expiresAt < new Date()) {
      await prisma.qrSession.update({ where: { id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ status: 'EXPIRED' })
    }

    return NextResponse.json({
      status: qr.status,
      // Hanya kirim info user kalau sudah APPROVED
      ...(qr.status === 'APPROVED' && {
        user: {
          id: qr.userId,
          email: qr.userEmail,
          name: qr.userName,
          role: qr.userRole,
        },
      }),
    })
  } catch (err) {
    console.error('QR poll error:', err)
    return NextResponse.json({ error: 'Gagal cek status QR' }, { status: 500 })
  }
}
