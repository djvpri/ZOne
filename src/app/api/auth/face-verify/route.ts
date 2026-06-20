import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const ZFACE_SECRET = process.env.FACE_LOGIN_SECRET || process.env.NEXTAUTH_SECRET || ''

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

    const personName = payload.person_name
    const similarity = payload.similarity

    if (!personName) {
      return NextResponse.json({ error: 'No person identified' }, { status: 400 })
    }

    // 2. Find user in ZOne database
    let user = null

    // If email provided, try email match first
    if (email) {
      user = await prisma.user.findUnique({ where: { email } })
    }

    // If no user found, find by name (case-insensitive, partial match)
    if (!user) {
      const allUsers = await prisma.user.findMany()
      const faceName = personName.toLowerCase().trim()
      
      // Try exact name match first
      user = allUsers.find(u => u.name.toLowerCase().trim() === faceName)
      
      // If no exact match, try partial match (first name)
      if (!user) {
        const firstName = faceName.split(' ')[0]
        user = allUsers.find(u => {
          const userName = u.name.toLowerCase().trim()
          return userName.includes(firstName) || firstName.includes(userName.split(' ')[0])
        })
      }
    }

    if (!user) {
      return NextResponse.json({
        error: `Wajah "${personName}" terdeteksi tapi tidak ada user yang cocok di ZOne`,
        personName,
        similarity,
      }, { status: 404 })
    }

    // 3. Return verified user info
    return NextResponse.json({
      success: true,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      personName,
      similarity,
    })
  } catch (error) {
    console.error('Face verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
