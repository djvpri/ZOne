import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUSPICIOUS_ACTION_RE = /^[a-z0-9]{1,3}$|^0{10,}$|^x$|^y$/i

export function middleware(request: NextRequest) {
  const actionId = request.headers.get('next-action') || ''
  if (actionId && SUSPICIOUS_ACTION_RE.test(actionId)) {
    return new NextResponse(null, { status: 204 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
