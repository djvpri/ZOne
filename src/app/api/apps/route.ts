import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessEmail = (session.user as any)?.email || ''
  console.log(`[api/apps] session.email="${sessEmail}" user.id=${(session.user as any)?.id} role=${(session.user as any)?.role}`)

  const user = await prisma.user.findUnique({
    where: { email: sessEmail },
    // Kirim semua link (termasuk yang nonaktif) supaya dashboard bisa
    // menampilkannya dalam keadaan disabled (tetap terlihat, tak bisa diklik).
    include: { appLinks: { include: { app: true } } },
  })

  if (!user) {
    console.log(`[api/apps] USER NOT FOUND utk email="${sessEmail}" -> daftar app kosong`)
    return NextResponse.json([])
  }
  console.log(`[api/apps] user "${sessEmail}" appLinks=${user.appLinks.length}`)

  return NextResponse.json(
    user.appLinks.map((ua: any) => ({ app: ua.app, active: ua.active }))
  )
}
