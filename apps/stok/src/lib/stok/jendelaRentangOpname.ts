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
 *   dibuat PADA H-1 (`startDate - 1` WIB) (opname itu = baseline Saldo Awal).
 *   Tidak ada opname valid pada H-1 -> mulai tepat di `00:00 WIB` tanggal mulai,
 *   Saldo Awal jatuh ke saldo ledger sistem per `00:00 WIB`, sehingga transaksi
 *   hari-hari sebelumnya tidak ikut terbawa ke rentang yang dipilih.
 * - Akhir jendela outlet X = waktu tutup opname finalized terakhir outlet X yang
 *   dibuat PADA tanggal akhir (WIB) (opname itu = fisik penutup). Tidak ada ->
 *   23:59:59.999999 WIB tanggal akhir, outlet itu tanpa fisik penutup.
 *
 * Hasilnya: bila outlet opname rutin tiap malam, rentang 21–22 Nov = sesi 21 Nov
 * + sesi 22 Nov (Saldo Awal sesi 20, mutasi 21–22, fisik sesi 22). Bila H-1 bolong
 * opname (atau telat difinalisasi lintas sesi), rentang mulai dari 00:00 WIB
 * tanggal mulai supaya hari sebelumnya tidak ikut terseret (dan breakdown harian
 * tidak menghitung dobel hari yang bolong).
 */

/**
 * Hanya cari opname baseline pada H-1 (1 hari sebelum `startDate`). Jika H-1
 * tidak ada opname valid, jendela mulai tepat di 00:00 WIB `startDate` dan
 * saldo awal diambil dari saldo ledger sistem per 00:00 WIB.
 */
export const BATAS_MUNDUR_BASELINE_HARI = 1

/**
 * Toleransi maksimal keterlambatan finalisasi melewati tengah malam tanggal
 * opname penutup (24 jam → approval pagi/siang esok hari masih sah, sedangkan
 * draf lama yang baru difinalisasi beberapa hari kemudian tidak dipakai
 * sebagai batas jendela hari itu).
 */
export const TOLERANSI_TUTUP_PENUTUP_MS = 24 * 60 * 60 * 1000

export interface OpnameRingkas {
  id: string
  outlet_id: string
  created_at: string
  updated_at?: string | null
  finalized_at?: string | null
  status?: string | null
}

/** Estimasi waktu tutup sebuah opname dari map waktuTutup (ledger) atau metadata opname. */
function waktuTutupEfektif(o: OpnameRingkas, waktuTutup?: Map<string, string>): string {
  const dariMap = waktuTutup?.get(o.id)
  if (dariMap) return dariMap
  if (o.finalized_at) return o.finalized_at
  if (o.updated_at && (!o.status || o.status === 'finalized')) return o.updated_at
  return o.created_at
}

/**
 * Deteksi opname yang difinalisasi melompati opname lebih baru di outlet yang sama:
 * ada opname B dengan `B.created_at > A.created_at` namun `waktuTutup(B) < waktuTutup(A)`.
 * Contoh nyata: MITRA KALISARI opname 1 Nov (dibuat 1 Nov 22:39) baru difinalisasi
 * 5 Nov 21:20, sesudah opname 2–4 Nov tutup lebih dulu. Opname seperti ini tidak
 * pernah mempengaruhi saldo sistem pada 1–4 Nov dan justru membalik jendela audit
 * (`start > end`) bila dipilih sebagai baseline.
 */
export function deteksiOpnameTerlambatLintasSesi<T extends OpnameRingkas>(
  opnames: T[],
  waktuTutup?: Map<string, string>
): Set<string> {
  const perOutlet = new Map<string, T[]>()
  for (const o of opnames) {
    const list = perOutlet.get(o.outlet_id)
    if (list) list.push(o)
    else perOutlet.set(o.outlet_id, [o])
  }

  const terlambat = new Set<string>()
  for (const list of perOutlet.values()) {
    // Urut created_at naik; scan dari belakang sambil melacak waktuTutup terkecil
    // dari opname yang lebih baru.
    const urut = [...list].sort(
      (a, b) => keMikrodetik(a.created_at) - keMikrodetik(b.created_at)
    )
    let minTutupLebihBaru = Infinity
    for (let i = urut.length - 1; i >= 0; i--) {
      const cur = urut[i]
      const tCur = keMikrodetik(waktuTutupEfektif(cur, waktuTutup))
      if (tCur > minTutupLebihBaru) {
        terlambat.add(cur.id)
      } else {
        minTutupLebihBaru = tCur
      }
    }
  }
  return terlambat
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
 *
 * Opname yang difinalisasi telat melompati sesi lebih baru (mis. draf 1 Nov
 * baru difinalisasi 5 Nov, sesudah opname 2 Nov tutup) atau melampaui batas
 * toleransi tanggal secara otomatis dilewati agar periode audit tidak pernah
 * terbalik (`start >= end`).
 */
export function pilihOpnameRentang<T extends OpnameRingkas>(args: {
  outletIds: string[]
  startDate: string
  endDate: string
  opnames: T[]
  waktuTutup?: Map<string, string>
}): Map<string, PilihanOpnameOutlet<T>> {
  const mulaiHari = batasHariWIB(args.startDate)
  const awalMulai = keMikrodetik(mulaiHari.awalIso)
  const akhirMulai = keMikrodetik(mulaiHari.akhirIso)
  const batasMundur = awalMulai - BATAS_MUNDUR_BASELINE_HARI * 86_400_000_000
  const akhirHari = batasHariWIB(args.endDate)
  const awalAkhir = keMikrodetik(akhirHari.awalIso)
  const akhirAkhir = keMikrodetik(akhirHari.akhirIso)
  const batasTutupPenutup = akhirAkhir + TOLERANSI_TUTUP_PENUTUP_MS * 1000

  const terlambat = deteksiOpnameTerlambatLintasSesi(args.opnames, args.waktuTutup)

  const out = new Map<string, PilihanOpnameOutlet<T>>()
  for (const id of args.outletIds) out.set(id, { awal: null, penutup: null })

  // Tahap 1: pilih opname penutup pada tanggal akhir (WIB)
  for (const o of args.opnames) {
    const p = out.get(o.outlet_id)
    if (!p || terlambat.has(o.id)) continue
    const t = keMikrodetik(o.created_at)
    if (t >= awalAkhir && t <= akhirAkhir) {
      const tTutup = keMikrodetik(waktuTutupEfektif(o, args.waktuTutup))
      if (tTutup > batasTutupPenutup) continue
      if (!p.penutup || t > keMikrodetik(p.penutup.created_at)) p.penutup = o
    }
  }

  // Tahap 2: pilih opname baseline sebelum 00:00 WIB tanggal mulai yang waktu
  // tutupnya memang mendahului akhir jendela & tidak loncat hari lewat startDate.
  for (const o of args.opnames) {
    const p = out.get(o.outlet_id)
    if (!p || terlambat.has(o.id)) continue
    const t = keMikrodetik(o.created_at)
    if (t < awalMulai && t >= batasMundur) {
      const tTutup = keMikrodetik(waktuTutupEfektif(o, args.waktuTutup))
      const batasEnd = p.penutup
        ? keMikrodetik(waktuTutupEfektif(p.penutup, args.waktuTutup))
        : akhirAkhir
      if (tTutup >= batasEnd || tTutup > akhirMulai) continue
      if (!p.awal || t > keMikrodetik(p.awal.created_at)) p.awal = o
    }
  }
  return out
}

/**
 * Susun jendela per outlet dari pilihan opname + waktu tutupnya
 * (lib/stok/waktuTutupOpname). Waktu tutup yang tak diketahui jatuh ke
 * `created_at` opname. Jika setelah resolusi ledger ternyata `start >= end`,
 * baseline dilepas ke `awalHari` agar jendela tidak pernah terbalik.
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
    let start = awal ? args.waktuTutup.get(awal.id) ?? awal.created_at : awalHari
    const end = penutup ? args.waktuTutup.get(penutup.id) ?? penutup.created_at : akhirHari
    let awalId = awal?.id ?? null
    if (awalId && keMikrodetik(start) >= keMikrodetik(end)) {
      start = awalHari
      awalId = null
    }
    out.set(id, {
      start,
      end,
      opname_awal_id: awalId,
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
