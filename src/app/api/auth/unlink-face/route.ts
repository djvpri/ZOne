import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.faceId) {
      return NextResponse.json({ error: 'Belum ada wajah terdaftar' }, { status: 400 })
    }

    await prisma.user.update({
      where: { email },
      data: { faceId: null },
    })

    return NextResponse.json({ success: true, message: 'Wajah berhasil dihapus' })
  } catch (error) {
    console.error('Unlink face error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
