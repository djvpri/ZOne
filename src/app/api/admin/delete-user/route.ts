import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123'

export async function POST(req: Request) {
  try {
    const { email, adminKey } = await req.json()

    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete related records first
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await prisma.userApp.deleteMany({ where: { userId: user.id } })
    await prisma.activity.deleteMany({ where: { userId: user.id } })
    
    // Delete user
    await prisma.user.delete({ where: { email } })

    return NextResponse.json({ success: true, deleted: email })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
