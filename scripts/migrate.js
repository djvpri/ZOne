const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function migrate() {
  console.log('Running Z One migrations...')
  const run = async (sql) => {
    try { await p.$executeRawUnsafe(sql) }
    catch (e) { if (!e.message?.includes('already exists')) console.warn('warn:', e.message?.slice(0,80)) }
  }

  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone TEXT`)
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS avatar TEXT`)
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS bio TEXT`)
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "faceId" TEXT`)
  await run(`DO $x$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='User_faceId_key') THEN ALTER TABLE "User" ADD CONSTRAINT "User_faceId_key" UNIQUE ("faceId"); END IF; END $x$`)
  await run(`CREATE TABLE IF NOT EXISTS "UserApp" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),"userId" TEXT NOT NULL,"appId" TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "UserApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,CONSTRAINT "UserApp_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"(id) ON DELETE CASCADE,CONSTRAINT "UserApp_userId_appId_key" UNIQUE ("userId","appId"))`)
  await run(`CREATE TABLE IF NOT EXISTS "Activity" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),"userId" TEXT NOT NULL,action TEXT NOT NULL,detail TEXT,"appSlug" TEXT,"createdAt" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE)`)
  await run(`CREATE INDEX IF NOT EXISTS "Activity_userId_idx" ON "Activity"("userId")`)
  await run(`CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON "Activity"("createdAt")`)
  await run(`DO $x$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='QrStatus') THEN CREATE TYPE "QrStatus" AS ENUM ('PENDING','SCANNED','APPROVED','EXPIRED','CANCELLED'); END IF; END $x$`)
  await run(`CREATE TABLE IF NOT EXISTS "QrSession" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,status "QrStatus" NOT NULL DEFAULT 'PENDING',"userId" TEXT,"userEmail" TEXT,"userName" TEXT,"userRole" TEXT,"expiresAt" TIMESTAMP NOT NULL,"approvedAt" TIMESTAMP,"createdAt" TIMESTAMP NOT NULL DEFAULT now())`)
  await run(`CREATE INDEX IF NOT EXISTS "QrSession_token_idx" ON "QrSession"(token)`)
  await run(`CREATE INDEX IF NOT EXISTS "QrSession_expiresAt_idx" ON "QrSession"("expiresAt")`)

  // Sistem afiliasi (sebelumnya dibuat manual — sekarang idempoten di sini
  // supaya deploy fresh langsung lengkap)
  await run(`DO $x$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='AffiliateType') THEN CREATE TYPE "AffiliateType" AS ENUM ('MITRA_LAPANGAN','CUSTOMER_REFERRAL'); END IF; END $x$`)
  await run(`CREATE TABLE IF NOT EXISTS "AffiliatePartner" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),"userId" TEXT NOT NULL UNIQUE,name TEXT NOT NULL,type "AffiliateType" NOT NULL,"referralCode" TEXT NOT NULL UNIQUE,"commissionRate" DECIMAL(5,2) NOT NULL,balance DECIMAL(12,2) NOT NULL DEFAULT 0,"bankAccount" TEXT,"bankName" TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',"createdAt" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "AffiliatePartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE)`)
  await run(`CREATE TABLE IF NOT EXISTS "CommissionTransaction" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),"affiliatePartnerId" TEXT NOT NULL,type TEXT NOT NULL,amount DECIMAL(12,2) NOT NULL,notes TEXT,"createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP NOT NULL DEFAULT now(),CONSTRAINT "CommissionTransaction_affiliatePartnerId_fkey" FOREIGN KEY ("affiliatePartnerId") REFERENCES "AffiliatePartner"(id) ON DELETE CASCADE)`)
  await run(`CREATE INDEX IF NOT EXISTS "CommissionTransaction_affiliatePartnerId_idx" ON "CommissionTransaction"("affiliatePartnerId")`)
  await run(`CREATE INDEX IF NOT EXISTS "CommissionTransaction_createdAt_idx" ON "CommissionTransaction"("createdAt")`)

  // Pengaturan situs (maintenance mode, pengumuman, dll)
  // Satu baris per key — idempoten, aman dijalankan berulang.
  await run(`CREATE TABLE IF NOT EXISTS "SiteSettings" (key TEXT PRIMARY KEY, value TEXT NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedBy" TEXT)`)
  // Seed default maintenance = false kalau belum ada
  await run(`INSERT INTO "SiteSettings" (key, value, "updatedAt") VALUES ('maintenance_enabled', 'false', now()) ON CONFLICT (key) DO NOTHING`)
  await run(`INSERT INTO "SiteSettings" (key, value, "updatedAt") VALUES ('maintenance_message', 'Sistem sedang dalam pemeliharaan. Beberapa fitur mungkin tidak dapat diakses. Terima kasih atas pengertian Anda.', now()) ON CONFLICT (key) DO NOTHING`)

  console.log('Migrations done ✓')
}

// Normalisasi role lowercase legacy ('admin'/'staff') ke ADMIN
async function normalizeRoles() {
  try {
    await p.$executeRawUnsafe(`UPDATE "User" SET role = 'ADMIN' WHERE role IN ('admin', 'staff')`)
    console.log('Roles normalized ✓')
  } catch(e) { console.warn('normalize warn:', e.message?.slice(0,80)) }
}

migrate()
  .then(() => normalizeRoles())
  .catch(e => { console.error('Migration error:', e.message); process.exit(0) })
  .finally(() => p.$disconnect())
