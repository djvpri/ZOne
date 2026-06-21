import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Cross-app management API — proxy ke admin API tiap app spoke (ZGold, ZBengkel, dst).
// Daftar app & URL-nya dibaca dari tabel App (database), BUKAN hardcode di kode,
// supaya nambah app baru cukup tambah baris di /manage, tanpa edit kode/redeploy.

const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'

async function getApp(slug: string) {
  return prisma.app.findUnique({ where: { slug: slug.toLowerCase() } })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const slug = req.nextUrl.searchParams.get('app') || ''
    const app = await getApp(slug)
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: `App "${slug}" tidak ditemukan atau belum punya URL` }, { status: 400 })
    }
    const baseUrl = app.url.replace(/\/+$/, '')

    const response = await fetch(`${baseUrl}/api/admin/cross-app`, {
      headers: { Authorization: `Bearer ${CROSS_APP_SECRET}` },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `${app.name} returned ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Cross-app proxy error:', error)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { app: slug, action, email, data } = await req.json()
    const app = await getApp(String(slug || ''))
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: 'Invalid app' }, { status: 400 })
    }
    const baseUrl = app.url.replace(/\/+$/, '')

    const response = await fetch(`${baseUrl}/api/admin/cross-app`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CROSS_APP_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, email, data }),
    })

    const result = await response.json()
    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Cross-app proxy action error:', error)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}
