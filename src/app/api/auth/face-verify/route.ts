import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const ZFACE_SECRET = process.env.FACE_LOGIN_SECRET || process.env.NEXTAUTH_SECRET || ''
const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || 'z-ecosystem-admin-2026'
const APPS = {
  zgold: 'https://zgold-production.up.railway.app',
  zbengkel: 'https://zbengkel-production.up.railway.app',
  zlaundry: 'https://zlaundry-production.up.railway.app',
}

async function findUserInOtherApps(email: string): Promise<{ name: string; source: string } | null> {
  for (const [key, baseUrl] of Object.entries(APPS)) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/cross-app?app=${key}`, {
        headers: { 'Authorization': `Bearer ${CROSS_APP_SECRET}` },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const users = data.users || []
      const found = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (found) return { name: found.name, source: key }
    } catch {}
  }
  return null
}

export async function POST(req: Request) {
  try {
    const { faceToken, email } = await req.json()

    if (!faceToken) {
      return NextResponse.json({ error: 'Face token required' }, { status: 400 })
    }

    // 1. Verify the face token from ZFace
    let payload: any
    try {
      payload = jwt.verify(faceToken, ZFACE_SECRET)
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Face token expired' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Invalid face token' }, { status: 401 })
    }

    if (!payload.face_login) {
      return NextResponse.json({ error: 'Not a face login token' }, { status: 400 })
    }

    const faceId = payload.sub  // face_id from ZFace
    const personName = payload.person_name
    const similarity = payload.similarity

    if (!faceId) {
      return NextResponse.json({ error: 'No face ID in token' }, { status: 400 })
    }

    // 2. Find user in ZOne database by faceId (exact match!)
    let user = null

    // Primary: match by faceId (permanent solution)
    user = await prisma.user.findUnique({ where: { faceId } })

    // Fallback: if email provided, try email match
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } })
    }

    // Last resort: fuzzy name match (for backward compatibility)
    if (!user && personName) {
      const allUsers = await prisma.user.findMany()
      const faceName = personName.toLowerCase().trim()
      const faceParts = faceName.split(/\s+/)
      
      let bestScore = 0
      for (const u of allUsers) {
        const userName = u.name.toLowerCase().trim()
        const userParts = userName.split(/\s+/)
        
        let score = 0
        
        if (userName === faceName) {
          score = 100
        } else if (userName.includes(faceName) || faceName.includes(userName)) {
          score = 80
        } else {
          for (const fp of faceParts) {
            for (const up of userParts) {
              if (fp === up) score += 60
              else if (fp.includes(up) || up.includes(fp)) score += 30
            }
          }
        }
        
        if (score > bestScore) {
          bestScore = score
          user = u
        }
      }
      
      if (bestScore < 30) user = null
    }

    if (!user) {
      // SSO: Check other apps for this user
      // If email is linked in ZFace, try to find in other apps
      if (email) {
        const crossUser = await findUserInOtherApps(email)
        if (crossUser) {
          // Auto-create ZOne account
          const hashedPw = await bcrypt.hash(`face:${crossUser.name}`, 10)
          user = await prisma.user.create({
            data: {
              name: crossUser.name,
              email: email,
              password: hashedPw,
              role: 'USER',
              faceId: faceId,
            },
          })
          console.log(`[SSO Face] Auto-created ZOne account for ${email} from ${crossUser.source}`)
        }
      }
      
      if (!user) {
        return NextResponse.json({
          error: `Wajah "${personName}" terdeteksi tapi tidak ada user yang cocok di ZOne`,
          faceId,
          personName,
          similarity,
        }, { status: 404 })
      }
    }

    // 3. If user doesn't have faceId linked yet, link it now
    if (!user.faceId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { faceId },
      })
    }

    // 4. Return verified user info
    return NextResponse.json({
      success: true,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      faceId,
      personName,
      similarity,
    })
  } catch (error) {
    console.error('Face verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
