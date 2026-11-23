/**
 * Jendela waktu per outlet untuk Jurnal & Rekonsiliasi mode "Rentang Tanggal".
 *
 * Keputusan owner (23 Nov 2026): batas mode Rentang Tanggal disamakan dengan mode
 * Sesi Opname, PER OUTLET. Dulu jendela selalu 00:00–23:59 WIB, padahal opname
 * ditutup ±22.00 -- mutasi antara jam opname dan tengah malam jatuh di sisi yang
 * salah dan muncul sebagai selisih semu (MITRA CIBUBUR 19 Nov: 74 baris
 * pemakaian sesudah opname).
 *
 * - Awal jendela outlet X = waktu tutup opname finalized terakhir outlet X yang
 *   dibuat SEBELUM 00:00 WIB tanggal mulai (opname itu = baseline Saldo Awal).
 *   Tidak ada (atau lebih tua dari BATAS_MUNDUR_BASELINE_HARI) -> 00:00 WIB
 *   tanggal mulai, Saldo Awal jatuh ke saldo ledger.
 * - Akhir jendela outlet X = waktu tutup opname finalized terakhir outlet X yang
 *   dibuat PADA tanggal akhir (WIB) (opname itu = fisik penutup). Tidak ada ->
 *   23:59:59.999999 WIB tanggal akhir, outlet itu tanpa fisik penutup.
 *
 * Hasilnya: rentang 21–22 Nov satu outlet = sesi 21 Nov + sesi 22 Nov (Saldo Awal
 * sesi 21, mutasi kedua sesi, fisik sesi 22). "Dibuat sebelum" memakai
 * `opname.created_at`, sama dengan cara mode sesi mencari opname sebelumnya.
 */

/**
 * Baseline yang terlalu tua tidak dipakai: jendela sebuah outlet akan melebar
 * berminggu-minggu (dan di mode Semua Outlet ikut memperberat kueri), sementara
 * angkanya tak lagi bisa dibaca sebagai "rentang yang dipilih".
 */
export const BATAS_MUNDUR_BASELINE_HARI = 31

export interface OpnameRingkas {
  id: string
  outlet_id: string
  created_at: string
}

export interface PilihanOpnameOutlet<T extends OpnameRingkas = OpnameRingkas> {
  awal: T | null
  penutup: T | null
}

export interface JendelaWaktu {
  start: string
  end: string
}

export interface JendelaOutlet extends JendelaWaktu {
  opname_awal_id: string | null
  opname_penutup_id: string | null
}

/** Batas satu hari WIB (UTC+7, tanpa DST) sebagai ISO berzona. */
export function batasHariWIB(tanggal: string): { awalIso: string; akhirIso: string } {
  return {
    awalIso: `${tanggal}T00:00:00+07:00`,
    akhirIso: `${tanggal}T23:59:59.999999+07:00`,
  }
}

/**
 * Instan dalam mikrodetik sejak epoch. `Date.parse` hanya presisi milidetik,
 * sedangkan timestamp Postgres membawa 6 digit -- batas jendela (waktu tutup
 * opname) harus dibandingkan persis.
 */
export function keMikrodetik(iso: string): number {
  const ms = Date.parse(iso)
  const m = /\.(\d+)/.exec(iso)
  const sisa = m ? Number((m[1] + '000000').slice(3, 6)) : 0
  return ms * 1000 + sisa
}

export function dalamJendela(iso: string, j: JendelaWaktu): boolean {
  const t = keMikrodetik(iso)
  return t >= keMikrodetik(j.start) && t <= keMikrodetik(j.end)
}

/** Awal paling dini & akhir paling akhir dari beberapa jendela. */
export function rentangGabungan(list: Iterable<JendelaWaktu>): JendelaWaktu {
  let start: string | null = null
  let end: string | null = null
  for (const j of list) {
    if (start === null || keMikrodetik(j.start) < keMikrodetik(start)) start = j.start
    if (end === null || keMikrodetik(j.end) > keMikrodetik(end)) end = j.end
  }
  if (start === null || end === null) throw new Error('Jendela kosong')
  return { start, end }
}

/**
 * Pilih opname baseline & penutup per outlet dari daftar opname finalized
 * (urutan bebas). Outlet tanpa opname tetap mendapat entri { null, null }.
 */
export function pilihOpnameRentang<T extends OpnameRingkas>(args: {
  outletIds: string[]
  startDate: string
  endDate: string
  opnames: T[]
}): Map<string, PilihanOpnameOutlet<T>> {
  const awalMulai = keMikrodetik(batasHariWIB(args.startDate).awalIso)
  const batasMundur = awalMulai - BATAS_MUNDUR_BASELINE_HARI * 86_400_000_000
  const akhirHari = batasHariWIB(args.endDate)
  const awalAkhir = keMikrodetik(akhirHari.awalIso)
  const akhirAkhir = keMikrodetik(akhirHari.akhirIso)

  const out = new Map<string, PilihanOpnameOutlet<T>>()
  for (const id of args.outletIds) out.set(id, { awal: null, penutup: null })

  for (const o of args.opnames) {
    const p = out.get(o.outlet_id)
    if (!p) continue
    const t = keMikrodetik(o.created_at)
    if (t < awalMulai && t >= batasMundur) {
      if (!p.awal || t > keMikrodetik(p.awal.created_at)) p.awal = o
    }
    if (t >= awalAkhir && t <= akhirAkhir) {
      if (!p.penutup || t > keMikrodetik(p.penutup.created_at)) p.penutup = o
    }
  }
  return out
}

/**
 * Susun jendela per outlet dari pilihan opname + waktu tutupnya
 * (lib/stok/waktuTutupOpname). Waktu tutup yang tak diketahui jatuh ke
 * `created_at` opname.
 */
export function susunJendelaOutlet(args: {
  outletIds: string[]
  startDate: string
  endDate: string
  pilihan: Map<string, PilihanOpnameOutlet>
  waktuTutup: Map<string, string>
}): Map<string, JendelaOutlet> {
  const awalHari = batasHariWIB(args.startDate).awalIso
  const akhirHari = batasHariWIB(args.endDate).akhirIso
  const out = new Map<string, JendelaOutlet>()
  for (const id of args.outletIds) {
    const p = args.pilihan.get(id)
    const awal = p?.awal ?? null
    const penutup = p?.penutup ?? null
    out.set(id, {
      start: awal ? args.waktuTutup.get(awal.id) ?? awal.created_at : awalHari,
      end: penutup ? args.waktuTutup.get(penutup.id) ?? penutup.created_at : akhirHari,
      opname_awal_id: awal?.id ?? null,
      opname_penutup_id: penutup?.id ?? null,
    })
  }
  return out
}

/**
 * Filter PostgREST `.or(...)`: satu grup `and(outlet, kolom >= awal, kolom <= akhir)`
 * per outlet, supaya mode Semua Outlet tidak menarik baris di luar jendela
 * outletnya sendiri.
 */
export function filterOrJendela(jendela: Map<string, JendelaWaktu>, kolom: string): string {
  return [...jendela.entries()]
    .map(
      ([outletId, j]) =>
        `and(outlet_id.eq.${outletId},${kolom}.gte."${j.start}",${kolom}.lte."${j.end}")`
    )
    .join(',')
}

/** Ringkasan untuk label UI: berapa outlet punya baseline / opname penutup. */
export function cakupanJendela(jendela: Record<string, JendelaOutlet> | undefined): {
  total: number
  denganBaseline: number
  denganPenutup: number
} {
  const list = Object.values(jendela || {})
  return {
    total: list.length,
    denganBaseline: list.filter((j) => !!j.opname_awal_id).length,
    denganPenutup: list.filter((j) => !!j.opname_penutup_id).length,
  }
}
