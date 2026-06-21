import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }

    // Forward to ZFace face-login
    const zfaceFormData = new FormData()
    zfaceFormData.append('file', file)
    // Search in ZOne tenant only
    const orgId = process.env.NEXT_PUBLIC_ZFACE_ORG_ID || ''
    if (orgId) zfaceFormData.append('org_id', orgId)
    // Match ZFace UI threshold (0.40 instead of default 0.45)
    zfaceFormData.append('threshold', '0.40')

    const zfaceRes = await fetch('https://zface.zomet.my.id/api/auth/face-login', {
      method: 'POST',
      body: zfaceFormData,
      signal: AbortSignal.timeout(30000),  // 30s timeout for face detection
    })

    if (!zfaceRes.ok) {
      const err = await zfaceRes.json().catch(() => ({}))
      return NextResponse.json(err, { status: zfaceRes.status })
    }

    const data = await zfaceRes.json()
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Face detection timeout' }, { status: 504 })
    }
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
