import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { getCrossAppSecret } from '@/lib/secrets'

/**
 * POST /api/sso/link   { code }
 * Dipakai halaman /link: user yang sudah login di Z One menyetujui kode
 * device-code, lalu server Z One meng-claim kode itu ke API AcuMedis.
 *
 * Server tujuan diambil dari App.url di database (slug = 'acumedis').
 */
const APP_SLUG = process.env.SSO_LINK_APP_SLUG || 'acumedis'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Sesi Z One tidak ditemukan. Login dulu.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code = String(body?.code || '').toUpperCase().trim()
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ ok: false, error: 'Format kode tidak valid' }, { status: 400 })
  }

  const app = await prisma.app.findUnique({ where: { slug: APP_SLUG } })
  if (!app || !app.url || app.url === '#') {
    return NextResponse.json(
      { ok: false, error: `App "${APP_SLUG}" belum punya URL di Z One` },
      { status: 400 }
    )
  }
  if (!app.isActive) {
    return NextResponse.json({ ok: false, error: 'App sedang tidak aktif' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { appLinks: { include: { app: true } } },
  })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Akun tidak ditemukan' }, { status: 404 })
  }

  // hak akses: harus punya UserApp aktif untuk app ini (auto-provision kalau belum ada)
  const link = user.appLinks.find((ua: { app: { slug: string }; active: boolean }) => ua.app.slug === APP_SLUG)
  if (!link) {
    await prisma.userApp.create({ data: { userId: user.id, appId: app.id, active: true } })
    console.log(`[SSO/link] auto-provision: ${user.email} -> ${APP_SLUG}`)
  } else if (!link.active) {
    return NextResponse.json({ ok: false, error: 'Akun ini tidak punya akses ke aplikasi' }, { status: 403 })
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, app: APP_SLUG },
    getCrossAppSecret(),
    { algorithm: 'HS256', expiresIn: '300s' }
  )

  const target = app.url.trim().replace(/\/+$/, '')
  try {
    const res = await fetch(`${target}/v1/auth/sso/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, token }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || `Server aplikasi menolak (${res.status})` },
        { status: res.status === 200 ? 400 : res.status }
      )
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Tidak dapat menghubungi server aplikasi. Coba lagi.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, deepLink: `acumedis://sso?token=${encodeURIComponent(token)}` })
}
