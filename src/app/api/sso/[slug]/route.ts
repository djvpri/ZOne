import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'

// Daftar app yang sudah punya endpoint /sso (terima token dari Z One).
// Tambahkan slug app lain di sini begitu app tsb juga implement /sso di sisinya.
const SSO_ENABLED: Record<string, string> = {
  zface: 'https://zface.zomet.my.id',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const baseUrl = SSO_ENABLED[slug]
  if (!baseUrl) {
    return NextResponse.json({ error: `App "${slug}" belum mendukung SSO` }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { appLinks: { include: { app: true } } },
  })
  if (!user) {
    return NextResponse.redirect(new URL('/dashboard?sso_error=user_not_found', req.url))
  }

  // Cek hak akses: user harus punya UserApp aktif untuk app ini.
  const link = user.appLinks.find((ua) => ua.app.slug === slug)
  if (!link || !link.active) {
    return NextResponse.redirect(new URL(`/dashboard?sso_error=no_access&app=${slug}`, req.url))
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      app: slug,
    },
    CROSS_APP_SECRET,
    { algorithm: 'HS256', expiresIn: '60s' }
  )

  return NextResponse.redirect(`${baseUrl}/sso?token=${encodeURIComponent(token)}`)
}
