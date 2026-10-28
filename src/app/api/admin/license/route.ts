import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'

/**
 * POST /api/admin/license
 *   { app: 'acumedis', tenantId, plan, days?, maxPractitioners?, action? }
 *
 * Menerbitkan lisensi klinik lalu menitipkannya ke app tujuan lewat
 * /api/admin/cross-app (action 'setLicense'). Token ditandatangani HMAC dengan
 * CROSS_APP_SECRET yang sama, jadi app bisa memverifikasinya SENDIRI tanpa
 * menghubungi Z One — klinik dengan internet buruk tidak ikut terkunci.
 *
 * action:
 *   'extend' → perpanjang dari tanggal berakhir yang berlaku (bukan dari hari ini)
 *   'set'    → pasang tanggal persis (dipakai untuk koreksi)
 *   'suspend'/'activate' → tangguhkan atau aktifkan kembali lewat updateTenant
 */
function b64url(s: Buffer | string) {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function sign(payload: Record<string, unknown>, secret: string) {
  const body = b64url(JSON.stringify(payload))
  const mac = b64url(createHmac('sha256', secret).update(body).digest())
  return `${body}.${mac}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Khusus admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const slug = String(body.app || '').toLowerCase().trim()
  const tenantId = String(body.tenantId || '').trim()
  const action = String(body.action || 'extend')
  if (!slug) return NextResponse.json({ error: 'app wajib diisi' }, { status: 400 })
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })

  const app = await prisma.app.findUnique({ where: { slug } })
  if (!app?.url || app.url === '#') {
    return NextResponse.json({ error: `App "${slug}" belum punya URL` }, { status: 400 })
  }
  const baseUrl = app.url.trim().replace(/\/+$/, '')
  const secret = getCrossAppSecret()
  if (!secret) return NextResponse.json({ error: 'CROSS_APP_SECRET belum diatur' }, { status: 500 })

  // ambil tenant terkini dari app tujuan: tanggal berakhir yang berlaku harus
  // dibaca dari sana, bukan dari input, supaya perpanjangan tidak memundurkan
  let tenant: any = null
  try {
    const r = await fetch(`${baseUrl}/api/admin/cross-app`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    tenant = (data.tenants || []).find((t: any) => t.id === tenantId) || null
  } catch (e: any) {
    return NextResponse.json({ error: `Tidak bisa membaca data app: ${e.message}` }, { status: 502 })
  }
  if (!tenant) return NextResponse.json({ error: 'Klinik tidak ditemukan di app' }, { status: 404 })

  // tangguhkan / aktifkan: bukan soal tanggal, cukup teruskan
  if (action === 'suspend' || action === 'activate') {
    const r = await fetch(`${baseUrl}/api/admin/cross-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        action: action === 'suspend' ? 'deleteTenant' : 'reactivateTenant',
        data: { tenantId },
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: j.error || `HTTP ${r.status}` }, { status: r.status })
    return NextResponse.json({ ok: true, tenant: j.tenant })
  }

  const plan = String(body.plan || tenant.plan || 'starter').slice(0, 40)
  const maxPractitioners = Number.isFinite(body.maxPractitioners)
    ? Math.max(1, Math.min(100, Math.trunc(body.maxPractitioners)))
    : tenant.max_practitioners ?? 3

  // dasar perpanjangan: tanggal berakhir yang masih berlaku kalau belum lewat,
  // kalau sudah lewat mulai dari hari ini (jangan menghukum karena telat bayar)
  const now = Date.now()
  const current = tenant.expires_at ? new Date(tenant.expires_at).getTime() : 0
  let base = now
  if (action === 'extend' && current > now) base = current

  const days = Number.isFinite(body.days) ? Math.max(1, Math.trunc(body.days)) : 30
  const exp = action === 'set' && body.expiresAt
    ? new Date(String(body.expiresAt))
    : new Date(base + days * 86_400_000)

  if (isNaN(exp.getTime())) {
    return NextResponse.json({ error: 'tanggal berakhir tidak valid' }, { status: 400 })
  }

  const token = sign(
    {
      tenantId,
      plan,
      exp: exp.toISOString(),
      maxPractitioners,
      issuedAt: new Date(now).toISOString(),
    },
    secret
  )

  const r = await fetch(`${baseUrl}/api/admin/cross-app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ action: 'setLicense', data: { tenantId, token } }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: j.error || `HTTP ${r.status}` }, { status: r.status })

  // catat di Activity supaya ada jejak siapa memperpanjang kapan
  await prisma.activity.create({
    data: {
      userId: (session?.user as any)?.id || '',
      action: 'LICENSE',
      detail: `${slug}: ${plan} → ${exp.toISOString().slice(0, 10)} (${maxPractitioners} praktisi)`,
      appSlug: slug,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, plan, expiresAt: exp.toISOString(), maxPractitioners, tenant: j.tenant })
}
