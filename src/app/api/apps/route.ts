import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email || '' },
    // Hanya app yang aktif untuk user ini. Link nonaktif (dimatikan admin di
    // "Akses User") tidak boleh muncul di dashboard — konsisten dgn /api/sso/[slug]
    // yang juga menolak akses kalau link tidak aktif.
    include: { appLinks: { where: { active: true }, include: { app: true } } },
  })

  if (!user) return NextResponse.json([])

  return NextResponse.json(
    user.appLinks.map((ua: any) => ({ app: ua.app, active: ua.active }))
  )
}
