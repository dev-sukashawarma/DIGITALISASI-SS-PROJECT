import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaEnsured?: boolean
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

let ensurePromise: Promise<void> | null = null

export async function ensureDatabaseSchema() {
  if (globalForPrisma.schemaEnsured) return
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "kols" ADD COLUMN IF NOT EXISTS "facebook_url" TEXT;`
        )
        globalForPrisma.schemaEnsured = true
      } catch (err: any) {
        console.error('[Prisma Auto-Heal] Schema ensure notice:', err?.message || err)
      }
    })()
  }
  return ensurePromise
}

// Background trigger on server initialization
if (typeof window === 'undefined') {
  ensureDatabaseSchema().catch(() => {})
}
