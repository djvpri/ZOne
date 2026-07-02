import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret } from '@/lib/secrets'
const ZFACE_URL = 'https://zface.zomet.my.id'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') return null
  return session
}

// GET — ambil daftar wajah dari ZFace + status tautan ke akun Z One
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Ambil semua wajah dari ZFace (lintas org)
    const zfaceRes = await fetch(`${ZFACE_URL}/api/admin/cross-app`, {
      headers: { Authorization: `Bearer ${getCrossAppSecret()}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!zfaceRes.ok) return NextResponse.json({ error: 'Gagal mengambil data dari ZFace' }, { status: 502 })
    const zfaceData = await zfaceRes.json()

    // Ambil semua user Z One yang sudah punya faceId
    const zoneUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, faceId: true },
      orderBy: { name: 'asc' },
    })

    const linkedFaceIds = new Set(zoneUsers.filter((u: { faceId: string | null }) => u.faceId).map((u: { faceId: string | null }) => u.faceId!))

    return NextResponse.json({
      faces: (zfaceData.users || []).map((f: any) => ({
        faceId: String(f.id || f.face_id || f.faceId || ''),
        allIds: (f.all_ids || [f.id || f.face_id || f.faceId]).map(String),
        name: f.name || f.nama || '',
        faces: f.faces,
        linked_email: f.linked_email || null,
        linked_to_zone: (f.all_ids || [String(f.id)]).some((id: string) => linkedFaceIds.has(String(id))),
      })),
      zone_users: zoneUsers,
    })
  } catch (err) {
    console.error('face-link GET error:', err)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

// POST — tautkan atau lepas faceId dari akun User Z One
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, faceId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 })

  try {
    if (!faceId) {
      // Lepas tautan
      await prisma.user.update({ where: { id: userId }, data: { faceId: null } })
      return NextResponse.json({ success: true, linked: false })
    }

    // Pastikan faceId belum dipakai user lain
    const existing = await prisma.user.findUnique({ where: { faceId } })
    if (existing && existing.id !== userId) {
      return NextResponse.json({
        error: `faceId ini sudah ditautkan ke akun ${existing.name} (${existing.email})`,
      }, { status: 409 })
    }

    await prisma.user.update({ where: { id: userId }, data: { faceId } })
    return NextResponse.json({ success: true, linked: true })
  } catch (err) {
    console.error('face-link POST error:', err)
    return NextResponse.json({ error: 'Gagal memperbarui tautan' }, { status: 500 })
  }
}
