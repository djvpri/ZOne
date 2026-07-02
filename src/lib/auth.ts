import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getCrossAppSecret, getAuthSecret } from '@/lib/secrets'

const APPS = {
  zgold: 'https://zgold-production.up.railway.app',
  zbengkel: 'https://zbengkel-production.up.railway.app',
  zlaundry: 'https://zlaundry-production.up.railway.app',
}

// Grace period sesudah QR di-approve di HP: desktop polling tiap 2 detik,
// jadi 2 menit lebih dari cukup. Lewat itu token dianggap basi.
const QR_APPROVAL_GRACE_MS = 2 * 60 * 1000

async function findUserInOtherApps(email: string): Promise<{ name: string; source: string } | null> {
  for (const [key, baseUrl] of Object.entries(APPS)) {
    try {
      const res = await fetch(`${baseUrl}/api/admin/cross-app?app=${key}`, {
        headers: { 'Authorization': `Bearer ${getCrossAppSecret()}` },
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

          // QR login: password format "qr:{token}"
          // Token hanya valid kalau: status APPROVED, email cocok, approve-nya
          // masih segar (< grace period), dan langsung DIKONSUMSI (sekali pakai)
          // supaya tidak bisa di-replay.
          if (password.startsWith('qr:')) {
            const token = password.slice(3)
            const qr = await prisma.qrSession.findUnique({ where: { token } })
            if (!qr || qr.status !== 'APPROVED' || qr.userEmail !== email) return null
            if (!qr.approvedAt || Date.now() - qr.approvedAt.getTime() > QR_APPROVAL_GRACE_MS) return null

            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null

            // Konsumsi token: tandai EXPIRED supaya tidak bisa dipakai kedua kali
            await prisma.qrSession.update({ where: { token }, data: { status: 'EXPIRED' } })

            return { id: user.id, email: user.email, name: user.name, role: user.role }
          }

          // Verified face login: password format "verified-face:{loginToken}"
          // loginToken adalah JWT bertanda tangan yang HANYA bisa diterbitkan oleh
          // /api/auth/face-verify setelah token ZFace tervalidasi. Di sini cukup
          // verifikasi tanda tangan + purpose + kecocokan email. Tanpa JWT valid,
          // jalur ini tidak bisa dipakai — menutup celah "kirim faceId sembarang".
          if (password.startsWith('verified-face:')) {
            const loginToken = password.slice(14)
            let payload: any
            try {
              payload = jwt.verify(loginToken, getAuthSecret())
            } catch {
              return null
            }
            if (payload?.purpose !== 'zone-face-login') return null
            if ((payload?.email || '').toLowerCase() !== email.toLowerCase()) return null

            const user = await prisma.user.findUnique({ where: { id: payload.sub as string } })
            if (!user || user.email.toLowerCase() !== email.toLowerCase()) return null

            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              faceId: user.faceId,
            } as any
          }

          // Normal password login
          let user = await prisma.user.findUnique({ where: { email } })
          let isNewSSO = false

          // If not in ZOne DB, check other apps (SSO)
          if (!user) {
            const crossUser = await findUserInOtherApps(email)
            if (crossUser) {
              // Auto-create ZOne account dengan password placeholder acak
              // (user login lewat SSO/face/QR, atau reset password nanti)
              const hashedPw = await bcrypt.hash(randomBytes(24).toString('hex'), 10)
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
            const randomPw = await bcrypt.hash(randomBytes(24).toString('hex'), 10)
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
