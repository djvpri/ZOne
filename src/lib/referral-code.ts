// Generate kode referral unik dari nama/email user + suffix acak.
// Dipakai bareng oleh auto-create extension (prisma.ts) dan script backfill,
// supaya polanya konsisten di kedua tempat.
export function generateReferralCode(seed: string): string {
  const base =
    (seed || "USER")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "USER";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}
