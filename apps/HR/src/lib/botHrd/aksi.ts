import { z } from 'zod'

/** Maksimum blok aksi yang dijalankan per pesan bot. */
export const MAKS_AKSI = 5

/** Role HR yang boleh menjalankan aksi dari Bot HRD (huruf kapital seperti RoleContext). */
export const ROLE_AKSI = ['ADMIN_HR', 'OWNER', 'ADMIN', 'DEVELOPER']
export const bolehJalankanAksi = (role: string | null | undefined) => !!role && ROLE_AKSI.includes(role.toUpperCase())

const TGL = /^\d{4}-\d{2}-\d{2}$/
export function tanggalSah(s: string): boolean {
  if (!TGL.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

const label = z.string().min(1).max(200)
const id = z.string().min(1).max(64)

/** Path internal saja: diawali '/', bukan '//', tanpa skema/backslash/spasi. */
const pathBentuk = z
  .string()
  .max(200)
  .refine((p) => p.startsWith('/') && !p.startsWith('//') && !/[\\s:]/.test(p) && !p.includes('..'), 'path tidak sah')

export const SkemaAksi = z.discriminatedUnion('aksi', [
  z.object({ jenis: z.literal('aksi'), aksi: z.literal('setujui_cuti'), id, label }),
  z.object({ jenis: z.literal('aksi'), aksi: z.literal('tolak_cuti'), id, label, alasan: z.string().trim().min(3).max(500) }),
  z.object({ jenis: z.literal('aksi'), aksi: z.literal('setujui_kasbon'), id, label }),
  z.object({ jenis: z.literal('aksi'), aksi: z.literal('tolak_kasbon'), id, label, alasan: z.string().trim().max(500).optional() }),
  z.object({ jenis: z.literal('aksi'), aksi: z.literal('tinjau_ceklist'), id, label, tanggapan: z.string().max(1000).optional() }),
  z.object({
    jenis: z.literal('aksi'),
    aksi: z.literal('buka_halaman'),
    label,
    path: pathBentuk,
    query: z.record(z.string().max(100), z.string().max(200)).optional(),
  }),
  z
    .object({
      jenis: z.literal('aksi'),
      aksi: z.literal('unduh_rekap_absensi'),
      label,
      dari: z.string(),
      sampai: z.string(),
      outlet_id: z.string().max(64).optional(),
    })
    .refine((v) => tanggalSah(v.dari) && tanggalSah(v.sampai) && v.dari <= v.sampai, 'rentang tanggal tidak sah'),
])

export type BlokAksi = z.infer<typeof SkemaAksi>

/** Path harus persis salah satu route nav atau sub-path-nya (query/hash dibuang sebelum dicocokkan). */
export function pathDiizinkan(path: string, daftarHref: string[]): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const bersih = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return daftarHref.some((h) => (h === '/' ? bersih === '/' : bersih === h || bersih.startsWith(h + '/')))
}

export function bangunUrl(path: string, query?: Record<string, string>): string {
  const bersih = path.split(/[?#]/)[0]
  const qs = query && Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''
  return bersih + qs
}

export const kunciAksi = (percakapanId: string | null | undefined, indeksPesan: number, indeksBlok: number) =>
  `${percakapanId ?? 'baru'}:${indeksPesan}:${indeksBlok}`

/**
 * Nomor urut (mulai 0) tiap bagian bertipe aksi dalam satu pesan; bagian non-aksi null.
 * Aksi dengan nomor >= MAKS_AKSI harus dilewati.
 */
export function nomorUrutAksi(bagian: { jenis: string; blok?: { jenis: string } }[]): (number | null)[] {
  let n = 0
  return bagian.map((b) => (b.jenis === 'ui' && b.blok?.jenis === 'aksi' ? n++ : null))
}

export const melebihiBatas = (nomor: number) => nomor >= MAKS_AKSI
