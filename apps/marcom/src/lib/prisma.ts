import { PrismaClient } from '@prisma/client'
import { buildSchemaGuardStatements } from './schema-guard'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaEnsured?: boolean
  schemaEnsurePromise?: Promise<void> | null
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Menutup drift antara DB produksi dan `prisma/schema.prisma`.
 *
 * Dijalankan satu pernyataan per query supaya satu kegagalan (mis. hak akses
 * kurang untuk menambah constraint) tidak membatalkan sisanya. Semua pernyataan
 * idempoten — lihat catatan di `schema-guard.ts`.
 *
 * Gagal TIDAK di-cache: kalau DB sedang tidak bisa dihubungi saat boot, panggilan
 * berikutnya mencoba lagi. (Versi sebelumnya menyimpan promise yang sudah resolve
 * meski ALTER-nya gagal, jadi tak pernah mencoba ulang.)
 */
export async function ensureDatabaseSchema() {
  if (globalForPrisma.schemaEnsured) return
  if (!globalForPrisma.schemaEnsurePromise) {
    globalForPrisma.schemaEnsurePromise = (async () => {
      const statements = buildSchemaGuardStatements()
      let failed = 0

      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement)
        } catch (err: any) {
          failed++
          console.error(
            '[Prisma Schema Guard] gagal:',
            statement.split('\n')[0],
            '→',
            err?.message || err
          )
        }
      }

      if (failed === 0) {
        globalForPrisma.schemaEnsured = true
      } else {
        // Biarkan percobaan berikutnya jalan lagi.
        globalForPrisma.schemaEnsurePromise = null
        console.error(
          `[Prisma Schema Guard] ${failed}/${statements.length} pernyataan gagal — akan dicoba ulang pada request berikutnya.`
        )
      }
    })().catch((err) => {
      globalForPrisma.schemaEnsurePromise = null
      console.error('[Prisma Schema Guard] tidak bisa dijalankan:', err)
    })
  }
  return globalForPrisma.schemaEnsurePromise
}

// Pemicu di latar belakang saat server start, supaya request pertama tidak menunggu.
if (typeof window === 'undefined') {
  ensureDatabaseSchema().catch(() => {})
}
