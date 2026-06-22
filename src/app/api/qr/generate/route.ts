import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Generate QR session baru — dipanggil saat halaman login dibuka/refresh QR
// QR berlaku 60 detik, setelah itu expired dan desktop harus minta QR baru
export async function POST() {
  try {
    // Bersihkan QR lama yang expired
    await prisma.qrSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })

    const qr = await prisma.qrSession.create({
      data: {
        expiresAt: new Date(Date.now() + 60 * 1000), // 60 detik
      },
    })

    return NextResponse.json({ id: qr.id, token: qr.token, expiresAt: qr.expiresAt })
  } catch (err) {
    console.error('QR generate error:', err)
    return NextResponse.json({ error: 'Gagal generate QR' }, { status: 500 })
  }
}
