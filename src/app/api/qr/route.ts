import { NextRequest, NextResponse } from 'next/server'
import { toBuffer } from 'qrcode'

// Render QR PNG utk link join member (dipakai /manage utk tampil QR per tenant).
// GET /api/qr?text=<url>&s=<px>  -> image/png
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text') || ''
  if (!text) return NextResponse.json({ error: 'text wajib' }, { status: 400 })
  const width = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('s') || '280', 10) || 280, 120), 640)
  try {
    const buf = await toBuffer(text, { type: 'png', width, margin: 2, errorCorrectionLevel: 'M' })
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } })
  } catch (e) {
    console.error('QR render error:', e)
    return NextResponse.json({ error: 'Gagal render QR' }, { status: 500 })
  }
}
