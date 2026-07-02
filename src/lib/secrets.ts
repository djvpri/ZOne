// Helper akses secret ekosistem. TIDAK ada fallback hardcode di sini —
// repo ini public, jadi nilai default yang ter-commit sama saja bocor.
// Kalau env belum di-set, lebih baik gagal keras (fail fast) daripada
// diam-diam jalan pakai secret yang semua orang bisa baca di GitHub.

// Migration 2026-07-02: Dual secret support during transition period
const NEW_SECRET = process.env.CROSS_APP_SECRET
const OLD_SECRET = 'z-ecosystem-admin-2026' // Temporary fallback during migration
const VALID_SECRETS = NEW_SECRET ? [NEW_SECRET, OLD_SECRET] : [OLD_SECRET]

export function getCrossAppSecret(): string {
  if (!NEW_SECRET) {
    console.warn('CROSS_APP_SECRET not set, using OLD_SECRET (migration fallback)')
  }
  return NEW_SECRET || OLD_SECRET
}

export function isValidCrossAppSecret(token: string): boolean {
  return VALID_SECRETS.includes(token)
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET / NEXTAUTH_SECRET belum di-set.')
  }
  return secret
}
