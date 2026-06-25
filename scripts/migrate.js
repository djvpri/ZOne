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

  console.log('Migrations done ✓')
}

migrate().catch(e => { console.error('Migration error:', e.message); process.exit(0) }).finally(() => p.$disconnect())

// Fix enum Role
async function fixRole() {
  const p = new PrismaClient()
  try {
    // Cek tipe kolom role saat ini
    await p.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT`)
    await p.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='Role') THEN CREATE TYPE "Role" AS ENUM ('USER','ADMIN','staff'); END IF; END $$`)
    await p.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN role TYPE "Role" USING role::"Role"`)
    await p.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'USER'::"Role"`)
    console.log('Role enum fixed ✓')
  } catch(e) { console.warn('Role fix warn:', e.message?.slice(0,100)) }
  finally { await p.$disconnect() }
}
