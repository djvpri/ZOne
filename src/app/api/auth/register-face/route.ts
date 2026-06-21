import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name required' }, { status: 400 })
    }

    // Forward to ZFace /api/register-public (no auth required)
    const zfaceFormData = new FormData()
    zfaceFormData.append('name', name)
    zfaceFormData.append('file', file)
    // Attach org_id so face goes to correct tenant
    zfaceFormData.append('org_id', process.env.NEXT_PUBLIC_ZFACE_ORG_ID || '')

    const zfaceRes = await fetch('https://zface.zomet.my.id/api/register-public', {
      method: 'POST',
      body: zfaceFormData,
      signal: AbortSignal.timeout(30000),
    })

    if (!zfaceRes.ok) {
      const err = await zfaceRes.json().catch(() => ({}))
      return NextResponse.json(err, { status: zfaceRes.status })
    }

    const data = await zfaceRes.json()
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Face registration timeout' }, { status: 504 })
    }
    console.error('Register face proxy error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
