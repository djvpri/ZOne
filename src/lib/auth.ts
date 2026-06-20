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
            const faceName = password.slice(5) // Remove "face:" prefix
            
            // Find user by email
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            
            // Check if user name matches face name (case-insensitive)
            const userName = user.name.toLowerCase().trim()
            const faceNameLower = faceName.toLowerCase().trim()
            
            // Allow partial match (first name or full name)
            if (userName.includes(faceNameLower) || faceNameLower.includes(userName.split(' ')[0])) {
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                plan: user.plan,
              } as any
            }
            
            // Name doesn't match
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
            plan: user.plan,
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
        token.plan = user.plan
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.plan = token.plan as string
      }
      return session
    },
  },
})
