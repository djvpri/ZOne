import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCrossAppSecret } from '@/lib/secrets'
import jwt from 'jsonwebtoken'

interface Props {
  searchParams: Promise<{ callback?: string; app?: string }>
}

// Hanya izinkan callback ke localhost (keamanan: cegah open redirect)
function isAllowedCallback(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export default async function DesktopLoginPage({ searchParams }: Props) {
  const { callback, app } = await searchParams

  if (!callback || !isAllowedCallback(callback)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center p-8 max-w-sm">
          <p className="text-red-400 font-semibold mb-2">URL callback tidak valid</p>
          <p className="text-slate-400 text-sm">Hanya callback ke localhost yang diizinkan.</p>
        </div>
      </div>
    )
  }

  const session = await auth()

  if (!session?.user?.email) {
    const callbackUrl = `/desktop-login?callback=${encodeURIComponent(callback)}&app=${app ?? 'zface'}`
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  // Generate short-lived SSO token (5 menit)
  const token = jwt.sign(
    {
      email: session.user.email,
      app: app ?? 'zface',
    },
    getCrossAppSecret(),
    { expiresIn: '5m' }
  )

  const redirectUrl = `${callback}?token=${encodeURIComponent(token)}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center p-8 max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
          <span className="text-3xl font-bold">Z</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Login Berhasil</h1>
        <p className="text-slate-400 text-sm mb-6">
          Menghubungkan ke ZFace Desktop sebagai<br />
          <span className="text-white font-medium">{session.user.email}</span>
        </p>
        <p className="text-slate-500 text-xs mb-4">Mengalihkan ke aplikasi...</p>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.href = ${JSON.stringify(redirectUrl)}`,
          }}
        />
        <a
          href={redirectUrl}
          className="inline-block mt-2 text-blue-400 text-sm underline hover:text-blue-300"
        >
          Klik di sini jika tidak otomatis teralihkan
        </a>
      </div>
    </div>
  )
}
