export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Admin-only: update app URL (supaya SSO bisa jalan)
export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { slug, url } = await req.json()
    if (!slug || !url) {
      return NextResponse.json({ error: 'slug dan url wajib' }, { status: 400 })
    }

    const app = await prisma.app.update({
      where: { slug },
      data: { url: url.trim() },
    })

    return NextResponse.json({ success: true, app: { slug: app.slug, url: app.url } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// List all apps with URLs (admin only)
export async function GET() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apps = await prisma.app.findMany({
    select: { slug: true, name: true, url: true, isActive: true },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ apps })
}
