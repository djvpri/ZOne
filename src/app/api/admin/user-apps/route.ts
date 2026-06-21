import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mengatur app mana saja yang bisa diakses tiap user ZOne (tabel UserApp).
// Dipakai panel admin: satu user bisa jadi member di beberapa app, tapi
// tidak otomatis dapat akses ke semua app.

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { userId, appId, active } = await req.json()
    if (!userId || !appId) {
      return NextResponse.json({ error: 'userId dan appId wajib diisi' }, { status: 400 })
    }

    const link = await prisma.userApp.upsert({
      where: { userId_appId: { userId, appId } },
      update: { active: !!active },
      create: { userId, appId, active: !!active },
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Toggle user-app error:', error)
    return NextResponse.json({ error: 'Gagal mengubah akses' }, { status: 500 })
  }
}
