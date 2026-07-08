import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/settings — settings publik (untuk login page, tanpa auth)
export async function GET() {
  const PUBLIC_KEYS = ['maintenance_enabled', 'maintenance_message']
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT key, value FROM "SiteSettings" WHERE key = ANY($1::text[])`,
      PUBLIC_KEYS
    )) as any[]
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return NextResponse.json({ settings }, {
      headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' }
    })
  } catch {
    return NextResponse.json({
      settings: { maintenance_enabled: 'false', maintenance_message: '' }
    })
  }
}
