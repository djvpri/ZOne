import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/settings — settings publik (untuk login page, tanpa auth)
export async function GET() {
  const PUBLIC_KEYS = [
    'maintenance_enabled',
    'maintenance_message',
    // Lisensi global (biaya + rekening perpanjangan) — dipakai ZPos & app lain
    // utk tab lisensi. Sengaja publik: rekening pembayaran memang utk dilihat
    // tenant yang mau bayar, dan diatur admin via /api/admin/settings.
    'license_cost',
    'license_cost_yearly', // opsi tahunan (hemat)
    'license_rek_bank',
    'license_rek_nama',
    'license_rek_no',
    'license_whatsapp',
  ]
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
