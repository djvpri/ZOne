import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { getCrossAppSecret } from '@/lib/secrets'

// Di Railway, req.url berisi alamat internal (localhost:8080). Gunakan
// x-forwarded-* headers atau NEXTAUTH_URL untuk mendapat URL publik ZOne.
function zoneOrigin(req: NextRequest): string {
  const forced = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  if (forced) return forced.replace(/\/+$/, '')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host  = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (host) return `${proto}://${host}`
  return 'https://zone.zomet.my.id'
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const origin  = zoneOrigin(req)
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Ambil URL app dari database (data-driven, tidak hardcode lagi)
  const app = await prisma.app.findUnique({ where: { slug } })
  if (!app || !app.url || app.url === '#') {
    return NextResponse.json({ error: `App "${slug}" tidak ditemukan atau belum punya URL` }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { appLinks: { include: { app: true } } },
  })
  if (!user) {
    return NextResponse.redirect(`${origin}/dashboard?sso_error=user_not_found`)
  }

  // Cek hak akses: user harus punya UserApp aktif untuk app ini.
  // Kalau belum ada, auto-create (first-time access = grant akses).
  let link = user.appLinks.find((ua: { app: { slug: string }; active: boolean }) => ua.app.slug === slug)
  if (!link) {
    // Auto-provision: buat UserApp baru supaya user bisa langsung akses
    link = await prisma.userApp.create({
      data: { userId: user.id, appId: app.id, active: true },
    })
    console.log(`[SSO] Auto-provisioned access: ${user.email} → ${slug}`)
  } else if (!link.active) {
    // Record ada tapi inactive — jangan auto-reactivate, minta admin
    return NextResponse.redirect(`${origin}/dashboard?sso_error=no_access&app=${slug}`)
  }

  const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, app: slug },
    getCrossAppSecret(),
    { algorithm: 'HS256', expiresIn: '300s' }
  )

  return NextResponse.redirect(`${baseUrl}/sso?token=${encodeURIComponent(token)}`)
}
