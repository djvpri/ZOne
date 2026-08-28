import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'

// Absen mandiri member via QR absensi: zone.zomet.my.id/absen/<appSlug>/<joinToken>
// POST = pakai session user (harus login akun member hub) lalu forward ke spoke
//        cross-app 'selfCheckin' dgn email member utk check-in method='qr'.
// GET  = meta (nama app + status login) utk render halaman /absen.

async function getApp(slug: string) {
  return prisma.app.findUnique({ where: { slug: slug.toLowerCase() } })
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('app') || ''
    const app = await getApp(slug)
    if (!app) return NextResponse.json({ error: 'App tidak ditemukan' }, { status: 404 })
    const session = await auth()
    const u = session?.user as ({ id?: string; email?: string; name?: string } | undefined)
    return NextResponse.json({
      app: { name: app.name, slug: app.slug, url: app.url },
      loggedIn: Boolean(u?.id),
      email: u?.email || '',
      name: u?.name || '',
    })
  } catch (e) {
    console.error('[absen] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = (session?.user as ({ id?: string; email?: string; name?: string } | undefined)) || null
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Login dulu sebelum absen' }, { status: 401 })
  }

  try {
    const { app: slug, joinToken } = await req.json()
    const app = await getApp(String(slug || ''))
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: 'Invalid app' }, { status: 400 })
    }
    if (!joinToken) return NextResponse.json({ error: 'joinToken wajib' }, { status: 400 })

    let email = sessionUser.email
    if (!email) {
      const db = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { name: true, email: true } })
      email = db?.email || ''
      sessionUser.name = db?.name || sessionUser.name
    }
    email = String(email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Kontak admin (email tidak terdeteksi)' }, { status: 400 })

    const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()

    const response = await fetch(`${baseUrl}/api/admin/cross-app`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getCrossAppSecret()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'selfCheckin',
        email,
        data: { joinToken, email },
      }),
    })
    const result = await response.json().catch(() => ({ raw: '(non-JSON)' }))
    if (!response.ok) {
      console.error(`[absen] spoke selfCheckin gagal: status=${response.status} result=${JSON.stringify(result)}`)
      return NextResponse.json(
        { error: result?.error || `App ${app.name} return ${response.status}`, already: Boolean(result?.status === 'already') },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      already: false,
      app: app.name,
      attendance: result?.attendance || null,
    })
  } catch (e) {
    console.error('[absen] POST error:', e)
    return NextResponse.json({ error: 'Gagal terhubung ke app' }, { status: 502 })
  }
}
