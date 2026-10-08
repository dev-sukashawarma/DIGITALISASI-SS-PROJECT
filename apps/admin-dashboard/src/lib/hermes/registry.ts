import { z } from 'zod'
import type { KonteksPenjualan } from '@/lib/sukaBot/alat/penjualan'
import type { Domain } from './domain'
import type { AlatMcp, HasilAlat } from './mcp'
import type { KonteksAbsensi, KonteksHrRinci } from './absensi/tipe'
import type { KonteksFinance } from './finance/tipe'
import { ALAT_PENJUALAN } from './alat/penjualan'
import { ALAT_ABSENSI } from './alat/absensi'
import { ALAT_HR_RINCI } from './alat/hrRinci'
import { ALAT_FINANCE } from './alat/finance'

export interface KonteksHermes {
  penjualan: KonteksPenjualan
  absensi: KonteksAbsensi
  hrRinci: KonteksHrRinci
  finance: KonteksFinance
  sekarang: Date
}

export interface DefinisiAlat {
  nama: string
  domain: Domain
  deskripsi: string
  /** Nama layar sumber angka (meta.sumber). Default 'Rangkuman Penjualan'. */
  sumber?: string
  /** Catatan tetap untuk pembaca (meta.catatan), mis. batasan rumus. */
  catatanMeta?: string
  skema: z.ZodType
  /** Argumen contoh yang sah — dipakai test gerbang §6 (larangan data). */
  contoh: Record<string, unknown>
  jalankan(ctx: KonteksHermes, a: any): Promise<Record<string, unknown>>
}

export const ALAT_HERMES: DefinisiAlat[] = [...ALAT_PENJUALAN, ...ALAT_ABSENSI, ...ALAT_HR_RINCI, ...ALAT_FINANCE]

export function skemaJson(s: z.ZodType): Record<string, unknown> {
  const { $schema: _abaikan, ...sisa } = z.toJSONSchema(s) as Record<string, unknown>
  return sisa
}

function bungkus(def: DefinisiAlat, ambilKonteks: () => Promise<KonteksHermes>): AlatMcp {
  return {
    nama: def.nama,
    domain: def.domain,
    deskripsi: def.deskripsi,
    skemaInput: skemaJson(def.skema),
    async jalankan(args: unknown): Promise<HasilAlat> {
      const p = def.skema.safeParse(args ?? {})
      if (!p.success) {
        return { ok: false, pesan: `Argumen tidak valid: ${p.error.issues.map((i) => `${i.path.join('.') || '(akar)'} ${i.message}`).join('; ')}` }
      }
      try {
        const ctx = await ambilKonteks()
        const hasil = await def.jalankan(ctx, p.data)
        if (hasil.status === 'galat') return { ok: false, pesan: `Data tidak tersedia: ${String(hasil.pesan ?? 'galat')}` }
        return {
          ok: true,
          data: {
            ...hasil,
            meta: {
              sumber: def.sumber ?? 'Rangkuman Penjualan',
              dihitung_pada: ctx.sekarang.toISOString(),
              // `catatan` diisi alat SUKA Bot bila periode masih berjalan (hari ini/minggu ini).
              kelengkapan: hasil.catatan ? 'sebagian' : 'lengkap',
              ...(def.catatanMeta ? { catatan: def.catatanMeta } : {}),
            },
          },
        }
      } catch (e) {
        return { ok: false, pesan: `Data tidak tersedia: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  }
}

/** Konteks diambil malas & sekali per permintaan: initialize/tools/list tidak menyentuh DB. */
export function bangunAlatMcp(ambilKonteks: () => Promise<KonteksHermes>): AlatMcp[] {
  let janji: Promise<KonteksHermes> | null = null
  const sekali = () => (janji ??= ambilKonteks())
  return ALAT_HERMES.map((d) => bungkus(d, sekali))
}
