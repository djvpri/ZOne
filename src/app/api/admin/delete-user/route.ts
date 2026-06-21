import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    // Server-side auth: only ADMIN can delete users
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-deletion
    if (user.email === session.user?.email) {
      return NextResponse.json({ error: 'Tidak bisa hapus akun sendiri' }, { status: 400 })
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
