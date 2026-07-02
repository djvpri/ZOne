// Helper akses secret ekosistem. TIDAK ada fallback hardcode di sini —
// repo ini public, jadi nilai default yang ter-commit sama saja bocor.
// Kalau env belum di-set, lebih baik gagal keras (fail fast) daripada
// diam-diam jalan pakai secret yang semua orang bisa baca di GitHub.

export function getCrossAppSecret(): string {
  const secret = process.env.CROSS_APP_SECRET
  if (!secret) {
    throw new Error(
      'CROSS_APP_SECRET belum di-set. Tambahkan di Railway Variables (dan pastikan semua app spoke pakai nilai yang sama).'
    )
  }
  return secret
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET / NEXTAUTH_SECRET belum di-set.')
  }
  return secret
}
