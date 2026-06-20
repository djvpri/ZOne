import { NextRequest, NextResponse } from 'next/server'

// Cross-app management API
// Proxies requests to ZGold, ZBengkel, ZLaundry admin APIs

const APPS = {
  ZGOLD: {
    name: 'ZGold POS',
    url: process.env.ZGOLD_URL || 'https://zgold-production.up.railway.app',
    secret: process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026',
  },
  ZBENGKEL: {
    name: 'ZBengkel',
    url: process.env.ZBENGKEL_URL || 'https://zbengkel-production.up.railway.app',
    secret: process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026',
  },
  ZLAUNDRY: {
    name: 'ZLaundry',
    url: process.env.ZLAUNDRY_URL || 'https://zlaundry-production.up.railway.app',
    secret: process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026',
  },
}

export async function GET(req: NextRequest) {
  try {
    const appKey = req.nextUrl.searchParams.get('app')?.toUpperCase()
    if (!appKey || !APPS[appKey as keyof typeof APPS]) {
      return NextResponse.json({
        error: 'Missing or invalid app param',
        available: Object.keys(APPS),
      }, { status: 400 })
    }

    const app = APPS[appKey as keyof typeof APPS]

    const response = await fetch(`${app.url}/api/admin/cross-app`, {
      headers: { Authorization: `Bearer ${app.secret}` },
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
  try {
    const { app: appKey, action, email, data } = await req.json()

    if (!appKey || !APPS[appKey.toUpperCase()]) {
      return NextResponse.json({ error: 'Invalid app' }, { status: 400 })
    }

    const app = APPS[appKey.toUpperCase() as keyof typeof APPS]

    const response = await fetch(`${app.url}/api/admin/cross-app`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${app.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, email, data }),
    })

    const result = await response.json()
    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Cross-app proxy action error:', error)
    return NextResponse.json({ error: 'Failed to reach app' }, { status: 502 })
  }
}
