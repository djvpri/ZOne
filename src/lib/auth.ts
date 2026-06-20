import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        try {
          const email = credentials.email as string
          const password = credentials.password as string
          
          // Face login: password format is "face:PersonName"
          if (password.startsWith('face:')) {
            const faceName = password.slice(5)
            
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            
            const userName = user.name.toLowerCase().trim()
            const faceNameLower = faceName.toLowerCase().trim()
            
            if (userName.includes(faceNameLower) || faceNameLower.includes(userName.split(' ')[0])) {
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                faceId: user.faceId,
              } as any
            }
            return null
          }
          
          // Normal password login
          let user = await prisma.user.findUnique({ where: { email } })
          let isNewSSO = false
          
          // If not in ZOne DB, check other apps (SSO)
          if (!user) {
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
                },
              })
              isNewSSO = true
              console.log(`[SSO] Auto-created ZOne account for ${email} from ${crossUser.source}`)
            }
          }
          if (!user) return null
          
          // For SSO auto-created users, skip password check (they'll set up later)
          if (!isNewSSO) {
            const valid = await bcrypt.compare(password, user.password)
            if (!valid) return null
          }
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            faceId: user.faceId,
          } as any
        } catch (e) {
          console.error('Auth error:', e)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.faceId = (user as any).faceId || null
      }
      // Refresh role + faceId from DB on each token refresh
      if (token.id) {
        try {
          const { prisma } = require('@/lib/prisma')
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, faceId: true },
          })
          if (dbUser) {
            token.role = dbUser.role
            if (dbUser.faceId) token.faceId = dbUser.faceId
          }
        } catch {}
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        ;(session.user as any).faceId = token.faceId || null
      }
      return session
    },
  },
})
