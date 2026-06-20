import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { email, faceId } = await req.json()

    if (!email || !faceId) {
      return NextResponse.json({ error: 'Email and faceId required' }, { status: 400 })
    }

    // Check if faceId is already linked to another user
    const existingUser = await prisma.user.findUnique({ where: { faceId } })
    if (existingUser) {
      // Already linked - that's fine, just return success
      if (existingUser.email === email) {
        return NextResponse.json({ success: true, message: 'Face already linked' })
      }
      return NextResponse.json({ error: 'Wajah sudah terdaftar di akun lain' }, { status: 409 })
    }

    // Link faceId to user
    const user = await prisma.user.update({
      where: { email },
      data: { faceId },
    })

    return NextResponse.json({
      success: true,
      id: user.id,
      name: user.name,
      email: user.email,
      faceId,
    })
  } catch (error) {
    console.error('Link face error:', error)
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
  }
}
