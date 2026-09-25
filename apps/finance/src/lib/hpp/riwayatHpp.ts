/**
 * Riwayat HPP menu dengan tanggal berlaku (tabel `menu_hpp_riwayat`).
 *
 * Laporan dulu membaca `menu_items.hpp_override` / `channel_hpp` — angka HARI INI —
 * untuk penjualan tanggal berapa pun, sehingga mengganti HPP di tengah bulan
 * menggeser HPP seluruh bulan. Modul ini merekonstruksi nilai yang berlaku pada
 * tanggal order dan menimpakannya ke objek menu, supaya fungsi `getItemHpp` tiap
 * laporan tetap dipakai apa adanya (aturan HPP-nya sengaja tidak disatukan).
 *
 * Aturan rekonstruksi sama dengan `public.menu_hpp_pada` di DB:
 * per kunci, baris dengan berlaku_mulai terbesar yang <= tanggal; kunci tanpa
 * baris seperti itu = tidak ada; nilai null = kunci direset.
 * Spec: docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md
 */

export const KUNCI_HPP_OVERRIDE = 'hpp_override'

export interface BarisRiwayatHpp {
  menu_item_id: string
  kunci: string
  nilai: number | string | null
  berlaku_mulai: string
}

export interface NilaiHpp {
  hpp_override: number | null
  channel_hpp: Record<string, number>
}

type Titik = { tgl: string; nilai: number | null }
export type IndeksRiwayatHpp = Map<string, Map<string, Titik[]>>

export interface PenerapHpp {
  terapkan<T>(menu: T): T
  byId: Map<string, any>
  byName: Map<string, any>
}

type KlienBaca = { from: (tabel: string) => any }

const FORMAT_WIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function tanggalWib(waktu: string | Date): string {
  return FORMAT_WIB.format(typeof waktu === 'string' ? new Date(waktu) : waktu)
}

/** Semua baris riwayat. Gagal = lempar error — jangan diam-diam memakai angka hari ini. */
export async function ambilRiwayatHpp(supabase: KlienBaca): Promise<BarisRiwayatHpp[]> {
  const UKURAN = 1000
  const semua: BarisRiwayatHpp[] = []
  for (let dari = 0; ; dari += UKURAN) {
    const { data, error } = await supabase
      .from('menu_hpp_riwayat')
      .select('menu_item_id, kunci, nilai, berlaku_mulai')
      .order('id', { ascending: true })
      .range(dari, dari + UKURAN - 1)
    if (error) throw new Error(`Gagal memuat riwayat HPP: ${error.message}`)
    const halaman = (data ?? []) as BarisRiwayatHpp[]
    semua.push(...halaman)
    if (halaman.length < UKURAN) return semua
  }
}

/** Penanda versi untuk kunci cache: berubah setiap kali ada perubahan HPP. */
export async function ambilVersiRiwayatHpp(supabase: KlienBaca): Promise<string> {
  const { data, error } = await supabase
    .from('menu_hpp_riwayat')
    .select('dicatat_at')
    .order('dicatat_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Gagal memuat versi riwayat HPP: ${error.message}`)
  return (data?.[0]?.dicatat_at as string | undefined) ?? 'kosong'
}

export function indeksRiwayat(rows: BarisRiwayatHpp[]): IndeksRiwayatHpp {
  const indeks: IndeksRiwayatHpp = new Map()
  for (const r of rows) {
    let perKunci = indeks.get(r.menu_item_id)
    if (!perKunci) {
      perKunci = new Map()
      indeks.set(r.menu_item_id, perKunci)
    }
    let titik = perKunci.get(r.kunci)
    if (!titik) {
      titik = []
      perKunci.set(r.kunci, titik)
    }
    titik.push({
      tgl: String(r.berlaku_mulai).slice(0, 10),
      nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    })
  }
  for (const perKunci of indeks.values()) {
    for (const titik of perKunci.values()) titik.sort((a, b) => a.tgl.localeCompare(b.tgl))
  }
  return indeks
}

export function nilaiHppPada(indeks: IndeksRiwayatHpp, menuId: string, tgl: string): NilaiHpp | null {
  const perKunci = indeks.get(menuId)
  if (!perKunci) return null
  let hpp_override: number | null = null
  const channel_hpp: Record<string, number> = {}
  for (const [kunci, titik] of perKunci) {
    let nilai: number | null | undefined
    for (const t of titik) {
      if (t.tgl <= tgl) nilai = t.nilai
      else break
    }
    if (nilai === undefined) continue
    if (kunci === KUNCI_HPP_OVERRIDE) hpp_override = nilai
    else if (nilai !== null) channel_hpp[kunci] = nilai
  }
  return { hpp_override, channel_hpp }
}

function timpa<T>(menu: T, indeks: IndeksRiwayatHpp, tgl: string): T {
  const m = menu as any
  if (!m || typeof m !== 'object') return menu
  const v = typeof m.id === 'string' ? nilaiHppPada(indeks, m.id, tgl) : null
  const salinan: any = v ? { ...m, hpp_override: v.hpp_override, channel_hpp: v.channel_hpp } : { ...m }
  if (Array.isArray(m.package_items)) {
    salinan.package_items = m.package_items.map((p: any) =>
      p && p.component ? { ...p, component: timpa(p.component, indeks, tgl) } : p,
    )
  }
  return salinan as T
}

/**
 * `menus` = daftar menu yang sudah diambil halaman (boleh kosong).
 * `kunciNama` = normalisasi nama yang dipakai halaman untuk peta nama-nya.
 */
export function buatPenerapRiwayat(
  menus: any[],
  rows: BarisRiwayatHpp[],
  kunciNama: (nama: string) => string,
): { untuk(tgl: string): PenerapHpp } {
  const indeks = indeksRiwayat(rows)
  const asliById = new Map<string, any>()
  for (const m of menus) if (m?.id) asliById.set(m.id, m)
  const cache = new Map<string, PenerapHpp>()

  return {
    untuk(tgl: string): PenerapHpp {
      const ada = cache.get(tgl)
      if (ada) return ada
      const byId = new Map<string, any>()
      const byName = new Map<string, any>()
      for (const m of menus) {
        const t = timpa(m, indeks, tgl)
        if (m?.id) byId.set(m.id, t)
        if (m?.name) byName.set(kunciNama(m.name), t)
      }
      const penerap: PenerapHpp = {
        byId,
        byName,
        terapkan<T>(menu: T): T {
          const m = menu as any
          if (m && typeof m.id === 'string' && asliById.get(m.id) === m) return byId.get(m.id)
          return timpa(menu, indeks, tgl)
        },
      }
      cache.set(tgl, penerap)
      return penerap
    },
  }
}
