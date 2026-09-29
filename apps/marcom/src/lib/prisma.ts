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
 * Pertama mengecek apakah tabel dan kolom esensial sudah ada dengan 1 query cepat.
 * Jika sudah ada, langsung selesai (0 DDL query dijalankan).
 * Jika belum ada, baru menjalankan pernyataan DDL satu per satu.
 */
export async function ensureDatabaseSchema() {
  if (globalForPrisma.schemaEnsured) return
  if (!globalForPrisma.schemaEnsurePromise) {
    globalForPrisma.schemaEnsurePromise = (async () => {
      try {
        // Cek cepat: jika tabel dan kolom esensial sudah ada, lewati 147 DDL query
        const check = await prisma.$queryRaw<Array<{ has_expenses: boolean; has_threads: boolean }>>`
          SELECT 
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marcom_expenses') as has_expenses,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kols' AND column_name = 'threads_url') as has_threads;
        `
        if (check[0]?.has_expenses && check[0]?.has_threads) {
          globalForPrisma.schemaEnsured = true
          return
        }
      } catch {
        // Abaikan error pada cek awal dan lanjutkan ke guard lengkap jika diperlukan
      }

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
        // Biarkan percobaan berikutnya jalan lagi jika ada kegagalan nyata.
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

/**
 * Helper untuk query database dengan retry otomatis jika terjadi gangguan jaringan sementara (P1001, timeout, dsb).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const { retries = 2, delayMs = 350, label = 'DB Query' } = options
  let lastError: any

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      const isConnectionError =
        err?.message?.includes("Can't reach database server") ||
        err?.message?.includes('connection') ||
        err?.message?.includes('timeout') ||
        err?.code === 'P1001' ||
        err?.code === 'P1002' ||
        err?.code === 'P1017'

      if (attempt < retries && isConnectionError) {
        console.warn(`[${label}] Attempt ${attempt + 1} gagal (${err?.message?.substring(0, 80)}...). Mencoba lagi dalam ${delayMs * (attempt + 1)}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      } else {
        break
      }
    }
  }

  throw lastError
}

// Pemicu di latar belakang saat server start, supaya request pertama tidak menunggu.
if (typeof window === 'undefined') {
  ensureDatabaseSchema().catch(() => {})
}

