import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') return null
  return session
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const apps = await prisma.app.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ apps })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const slug = String(body.slug || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const url = String(body.url || '').trim()
  if (!slug || !name || !url) {
    return NextResponse.json({ error: 'slug, name, url wajib diisi' }, { status: 400 })
  }
  const existing = await prisma.app.findUnique({ where: { slug } })
  if (existing) return NextResponse.json({ error: `Slug "${slug}" sudah dipakai` }, { status: 400 })

  const app = await prisma.app.create({
    data: {
      slug, name, url,
      icon: body.icon || '📦',
      description: body.description || '',
      color: body.color || '#2563eb',
      category: body.category || 'general',
    },
  })
  return NextResponse.json({ app })
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
  const app = await prisma.app.update({ where: { id }, data: rest })
  return NextResponse.json({ app })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
  await prisma.app.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
