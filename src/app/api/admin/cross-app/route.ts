import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'

// Cross-app management API — proxy ke admin API tiap app spoke (ZGold, ZBengkel, dst).
// Daftar app & URL-nya dibaca dari tabel App (database), BUKAN hardcode di kode,
// supaya nambah app baru cukup tambah baris di /manage, tanpa edit kode/redeploy.


async function getApp(slug: string) {
  return prisma.app.findUnique({ where: { slug: slug.toLowerCase() } })
}

// Sinkron spoke -> hub: pastikan user spoke punya akun hub Z One + link aktif ke
// app-nya, supaya muncul & bisa dikelola di tab "Akses User". Akun hub yang sudah
// ada TIDAK ditimpa (update kosong). Kalau password diketahui (mis. saat admin
// bikin user dari kelola-per-app) dipakai supaya bisa login hub dgn kredensial sama;
// kalau tidak, dipasang password acak (user reset/SSO/face untuk login hub).
async function linkSpokeUserToHub(appId: string, u: { name?: string; email: string; password?: string }) {
  const email = (u.email || '').trim()
  if (!email) return
  const password = await bcrypt.hash(u.password || randomBytes(12).toString('hex'), 10)
  const hubUser = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: u.name || email, email, password, role: 'USER' },
  })
  await prisma.userApp.upsert({
    where: { userId_appId: { userId: hubUser.id, appId } },
    update: { active: true },
    create: { userId: hubUser.id, appId, active: true },
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const slug = req.nextUrl.searchParams.get('app') || ''
    const app = await getApp(slug)
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: `App "${slug}" tidak ditemukan atau belum punya URL` }, { status: 400 })
    }
    const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()

    const response = await fetch(`${baseUrl}/api/admin/cross-app`, {
      headers: { Authorization: `Bearer ${getCrossAppSecret()}` },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `${app.name} returned ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Cross-app proxy error:', error)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { app: slug, action, email: topEmail, data } = await req.json()
    const email = topEmail || data?.email
    const app = await getApp(String(slug || ''))
    if (!app || !app.url || app.url === '#') {
      return NextResponse.json({ error: 'Invalid app' }, { status: 400 })
    }
    const baseUrl = app.url.trim().replace(/\/+$/, '').toLowerCase()

    const response = await fetch(`${baseUrl}/api/admin/cross-app`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getCrossAppSecret()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, email, data }),
    })

    const result = await response.json()

    // Begitu user dibuat di spoke, buat juga akun hub + link app (best-effort,
    // jangan gagalkan response spoke kalau sinkron hub error).
    if (action === 'create' && response.ok && !result?.error && data?.email) {
      try {
        await linkSpokeUserToHub(app.id, { name: data.name, email: data.email, password: data.password })
      } catch (e) {
        console.error('Sinkron user spoke -> hub gagal:', e)
      }
    }

    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Cross-app proxy action error:', error)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}
