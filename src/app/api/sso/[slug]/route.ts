import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { getCrossAppSecret } from '@/lib/secrets'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', req.url))
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
    return NextResponse.redirect(new URL('/dashboard?sso_error=user_not_found', req.url))
  }

  // Cek hak akses: user harus punya UserApp aktif untuk app ini
  const link = user.appLinks.find((ua: { app: { slug: string }; active: boolean }) => ua.app.slug === slug)
  if (!link || !link.active) {
    return NextResponse.redirect(new URL(`/dashboard?sso_error=no_access&app=${slug}`, req.url))
  }

  const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, app: slug },
    getCrossAppSecret(),
    { algorithm: 'HS256', expiresIn: '300s' }
  )

  return NextResponse.redirect(`${baseUrl}/sso?token=${encodeURIComponent(token)}`)
}
