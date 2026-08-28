import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'

// Self-register member via QR/link: zone.zomet.my.id/join/<appSlug>/<joinToken>
// GET  = meta (nama app + status login) utk render halaman publik /join.
// POST = apply join: pakai session user (harus login) lalu POST spoke
//        cross-app 'createMember' (buat user role=member di tenant tsb), lalu
//        pastikan akun hub user ter-link ke app (UserApp active).
//
// Member BARU: daftar hub dulu (/register), login (callbackUrl=/join/...), baru
// POST apply. Member EXISTING: login dulu, POST apply (email unik per tenant di
// spoke -> idempoten "sudah member").

async function getApp(slug: string) {
  return prisma.app.findUnique({ where: { slug: slug.toLowerCase() } })
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('app') || ''
    const app = await getApp(slug)
    if (!app) return NextResponse.json({ error: 'App tidak ditemukan' }, { status: 404 })
    const session = await auth()
    const user = session?.user || null
    return NextResponse.json({
      app: { name: app.name, slug: app.slug, url: app.url },
      loggedIn: Boolean((user as any)?.id),
    })
  } catch (e) {
    console.error('[join] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = (session?.user as any) || null
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Login dulu sebelum join' }, { status: 401 })
  }

  try {
    const { app: slug, joinToken } = await req.json()
    const app = await getApp(String(slug || ''))
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: 'Invalid app' }, { status: 400 })
    }
    if (!joinToken) return NextResponse.json({ error: 'joinToken wajib' }, { status: 400 })

    // email jatuh dr session JWT — bisa hilang; fallback ke email DB hub.
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
        action: 'createMember',
        email,
        data: { joinToken, name: sessionUser.name || email, email },
      }),
    })
    const result = await response.json().catch(() => ({ raw: '(non-JSON)' }))
    if (!response.ok) {
      console.error(`[join] spoke createMember gagal: status=${response.status} result=${JSON.stringify(result)}`)
      return NextResponse.json({ error: result?.error || `App ${app.name} return ${response.status}` }, { status: response.status })
    }

    // Pastikan link hub user -> app aktif (muncul di dashboard hub) — best effort.
    try {
      const hubUser = await prisma.user.findUnique({ where: { id: sessionUser.id } })
      if (hubUser) {
        await prisma.userApp.upsert({
          where: { userId_appId: { userId: hubUser.id, appId: app.id } },
          update: { active: true },
          create: { userId: hubUser.id, appId: app.id, active: true },
        })
      }
    } catch (e) {
      console.error('[join] link UserApp gagal:', e)
    }

    return NextResponse.json({
      success: true,
      alreadyMember: Boolean(result?.alreadyMember),
      app: app.name,
      appUrl: baseUrl,
      tenantId: result?.tenantId || null,
    })
  } catch (e) {
    console.error('[join] POST error:', e)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}
