import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/settings — semua settings (admin only)
export async function GET() {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (!session || user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT key, value FROM "SiteSettings"`
    )) as any[]
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ settings: { maintenance_enabled: 'false', maintenance_message: '' } })
  }
}

// POST /api/admin/settings — update setting (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { role?: string; email?: string } | undefined
  if (!session || user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key, value } = await req.json()
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key & value wajib diisi' }, { status: 400 })
  }

  const ALLOWED = ['maintenance_enabled', 'maintenance_message']
  if (!ALLOWED.includes(key)) {
    return NextResponse.json({ error: 'Key tidak diizinkan' }, { status: 400 })
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteSettings" (key, value, "updatedAt", "updatedBy")
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = now(), "updatedBy" = $3`,
      key, String(value), user?.email ?? 'admin'
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
