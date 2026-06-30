import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email || '' },
    // Kirim semua link (termasuk yang nonaktif) supaya dashboard bisa
    // menampilkannya dalam keadaan disabled (tetap terlihat, tak bisa diklik).
    include: { appLinks: { include: { app: true } } },
  })

  if (!user) return NextResponse.json([])

  return NextResponse.json(
    user.appLinks.map((ua: any) => ({ app: ua.app, active: ua.active }))
  )
}
