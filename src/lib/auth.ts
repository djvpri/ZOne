import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Dual secret support during migration (2026-07-02)
const NEW_SECRET = process.env.CROSS_APP_SECRET || 'uurclTHL375CiZeWi2g4T3GczU2YNY9I1wzjlsVTgSk'
const OLD_SECRET = 'z-ecosystem-admin-2026'
const VALID_SECRETS = [NEW_SECRET, OLD_SECRET]

function isValidSecret(token: string): boolean {
  return VALID_SECRETS.includes(token)
}
const APPS = {
  zgold: 'https://zgold-production.up.railway.app',
  zbengkel: 'https://zbengkel-production.up.railway.app',
  zlaundry: 'https://zlaundry-production.up.railway.app',
}

async function findUserInOtherApps(email: string): Promise<{ name: string; source: string } | null> {
  for (const [key, baseUrl] of Object.entries(APPS)) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/cross-app?app=${key}`, {
        headers: { 'Authorization': `Bearer ${NEW_SECRET}` },
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      checks: ['state'], // disable PKCE - fix cookie issue di Railway
    }),
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

          // Login demo satu-klik (tombol "Coba sebagai Demo" di /login) — tanpa
          // ketik kredensial. Hanya berlaku untuk akun demo, dipicu sentinel
          // khusus (bukan password asli), jadi aman walau password demo acak.
          const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@zomet.my.id').toLowerCase()
          if (email.toLowerCase() === DEMO_EMAIL && password === 'demo-one-click') {
            const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
            if (!demo) return null
            return { id: demo.id, name: demo.name, email: demo.email, role: demo.role, faceId: demo.faceId } as any
          }

          // QR login: password format adalah "qr:{token}"
          if (password.startsWith('qr:')) {
            const token = password.slice(3)
            const { prisma } = await import('@/lib/prisma')
            const qr = await prisma.qrSession.findUnique({ where: { token } })
            if (!qr || qr.status !== 'APPROVED' || qr.userEmail !== email) return null
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            return { id: user.id, email: user.email, name: user.name, role: user.role }
          }

          // Verified face login: password format "verified-face:{faceId}"
          // Sudah divalidasi oleh /api/auth/face-verify, cukup cek email + faceId cocok
          if (password.startsWith('verified-face:')) {
            const faceId = password.slice(14)
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            // Accept kalau faceId cocok ATAU user memang punya faceId yang sudah ditautkan
            if (user.faceId === faceId || user.faceId) {
              return { id: user.id, email: user.email, name: user.name, role: user.role }
            }
            return null
          }

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
    async redirect({ url, baseUrl }: any) {
      // Izinkan redirect ke semua domain ekosistem zomet.my.id (untuk SSO antar app)
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      try {
        if (new URL(url).hostname.endsWith('.zomet.my.id')) return url
      } catch {}
      return baseUrl + '/dashboard'
    },
    async signIn({ user, account }: any) {
      // Saat login Google: auto-create akun Z One jika belum ada, atau link ke yang sudah ada
      if (account?.provider === 'google' && user?.email) {
        try {
          let dbUser = await prisma.user.findUnique({ where: { email: user.email } })
          if (!dbUser) {
            // Belum ada akun → daftarkan otomatis
            const randomPw = await bcrypt.hash(Math.random().toString(36), 10)
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split('@')[0],
                password: randomPw,
                role: 'USER',
              },
            })
          }
          // Sertakan id dan role ke user object supaya jwt callback bisa ambil
          user.id = dbUser.id
          user.role = dbUser.role
        } catch (err) {
          console.error('Google signIn error:', err)
          return false
        }
      }
      return true
    },
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
