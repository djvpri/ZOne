import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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
          const user = await prisma.user.findUnique({ where: { email } })
          if (!user) return null
          
          const valid = await bcrypt.compare(password, user.password)
          if (!valid) return null
          
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
