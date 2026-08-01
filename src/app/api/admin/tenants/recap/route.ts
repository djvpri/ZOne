import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'

// Rekap lintas-app: gabungkan tenant SEMUA app spoke + tanggal expiry-nya.
// Dipanggil tab "Rekap Tenant" di /manage. Setiap app yang tidak terjangkau
// ditandai failed, bukan gagalkan seluruh rekap.
export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apps = await prisma.app.findMany({ orderBy: { order: 'asc' } })
    const rows: any[] = []
    const failed: { app: string; error: string }[] = []

    for (const app of apps) {
      if (!app.url || app.url === '#') {
        failed.push({ app: app.name, error: 'URL belum diisi' })
        continue
      }
      const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()
      try {
        const res = await fetch(`${baseUrl}/api/admin/cross-app`, {
          headers: { Authorization: `Bearer ${getCrossAppSecret()}` },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) {
          failed.push({ app: app.name, error: `HTTP ${res.status}` })
          continue
        }
        const data = await res.json()
        const tenants = Array.isArray(data?.tenants) ? data.tenants : []
        for (const t of tenants) {
          const name = String(t.name ?? t.namaToko ?? t.nama ?? t.tenantName ?? '').trim()
          if (!name) continue
          rows.push({
            appName: app.name,
            appSlug: app.slug,
            tenantName: name,
            plan: t.plan ?? 'starter',
            active: t.active ?? t.aktif ?? t.isActive ?? false,
            expired: t.expires_at ?? t.expiresAt ?? t.langganan_sampai ?? null,
          })
        }
      } catch (e) {
        failed.push({ app: app.name, error: e instanceof Error ? e.message : 'timeout/network' })
      }
    }

    // Urut: expired terdekat dulu (null di akhir).
    rows.sort((a, b) => {
      if (!a.expired && !b.expired) return a.appName.localeCompare(b.appName)
      if (!a.expired) return 1
      if (!b.expired) return -1
      return new Date(a.expired).getTime() - new Date(b.expired).getTime()
    })

    return NextResponse.json({ tenants: rows, failed, totalApps: apps.length })
  } catch (e) {
    console.error('Tenant recap error:', e)
    return NextResponse.json({ error: 'Gagal memuat rekap' }, { status: 500 })
  }
}
