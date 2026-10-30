/**
 * Riwayat promo POS: mengubah log perubahan `outlet_promo_riwayat` (per baris
 * outlet) menjadi daftar promo yang dibaca manusia — sedang aktif atau sudah
 * tidak aktif — lengkap dengan jam mulai & selesai.
 *
 * Satu baris outlet bisa melewati banyak periode (nyala → ubah → mati → nyala
 * lagi). Setiap periode punya SATU konfigurasi: mengubah promo yang sedang
 * aktif menutup periode lama dan membuka periode baru, supaya "Diskon 10%
 * 1–5 Okt lalu 20% 5–9 Okt" tidak tampil sebagai satu promo.
 *
 * Periode dari banyak outlet digabung jadi satu entri bila promonya sama
 * (scope, menu, konfigurasi) dan waktunya sama — satu kali Simpan menulis
 * semua outlet dalam satu transaksi, jadi jamnya identik.
 *
 * Riwayat baru dicatat sejak migration 20261030110000. Untuk masa sebelumnya
 * hanya ada tanggal baris dibuat dan catatan pemakaian (promo_redemptions);
 * entri dari data itu ditandai `perkiraan` dan tidak pernah disajikan seolah
 * jam pasti.
 */

import { promoConfigSignature, promoOutletKey, type PromoScope } from './promoOutlets'
import { getPromoStatus } from './promoSchedule'

export type RiwayatAksi = 'awal' | 'dibuat' | 'dinyalakan' | 'dimatikan' | 'diubah' | 'dilepas' | 'dihapus'

export type RiwayatRow = {
  promo_row_id: string
  outlet_id: string | null
  scope: PromoScope
  menu_item_id: string | null
  aksi: RiwayatAksi
  is_active: boolean
  is_assigned: boolean
  konfigurasi: Record<string, any>
  diubah_pada: string
  diubah_oleh: string | null
}

/** Waktu pemakaian promo per baris outlet (promo_redemptions). */
export type PemakaianMap = Record<string, string[]>

export type AlasanSelesai = 'dimatikan' | 'dilepas' | 'dihapus' | 'diubah' | 'jadwal_selesai'

export type RiwayatEntry = {
  id: string
  status: 'aktif' | 'selesai'
  scope: PromoScope
  menuItemId: string | null
  /** Konfigurasi promo pada periode ini (nama, jenis, nilai, jadwal, ...). */
  konfigurasi: Record<string, any>
  outletIds: string[]
  /** Mulai berlaku. Null hanya untuk promo lama yang tak pernah tercatat dipakai. */
  mulai: string | null
  /** Berhenti berlaku. Null = masih aktif. */
  selesai: string | null
  alasanSelesai: AlasanSelesai | null
  /** Pelaku perubahan yang menutup periode; null = sistem/tidak diketahui. */
  diubahOleh: string | null
  /** Waktu disusun dari data sebelum riwayat dicatat (tanggal dibuat / pemakaian). */
  perkiraan: boolean
  dipakai: number
  pakaiPertama: string | null
  pakaiTerakhir: string | null
}

type Periode = {
  rowId: string
  outletId: string | null
  scope: PromoScope
  menuItemId: string | null
  konfigurasi: Record<string, any>
  mulai: string | null
  selesai: string | null
  alasanSelesai: AlasanSelesai | null
  diubahOleh: string | null
  perkiraan: boolean
  /** Hanya untuk entri "tidak pernah tercatat aktif": tanggal baris dibuat. */
  dibuat?: string
  /** Pemakaian yang jatuh di periode ini (diisi setelah semua periode tersusun). */
  waktuPakai?: string[]
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN)
const isAktif = (row: { is_active: boolean; is_assigned: boolean }) => row.is_active && row.is_assigned

/** Periode aktif per baris outlet, dari deretan kejadiannya. */
function periodeBaris(events: RiwayatRow[]): Periode[] {
  const sorted = [...events].sort((a, b) => ms(a.diubah_pada) - ms(b.diubah_pada))
  const result: Periode[] = []
  // Diisi lewat closure mulai()/tutup(); tanpa `as`, TS mempersempitnya ke null.
  let buka = null as Periode | null

  const tutup = (waktu: string, alasan: AlasanSelesai, oleh: string | null) => {
    if (!buka) return
    buka.selesai = waktu
    buka.alasanSelesai = alasan
    buka.diubahOleh = oleh
    result.push(buka)
    buka = null
  }
  const mulai = (ev: RiwayatRow, perkiraan: boolean) => {
    buka = {
      rowId: ev.promo_row_id,
      outletId: ev.outlet_id,
      scope: ev.scope,
      menuItemId: ev.menu_item_id,
      konfigurasi: ev.konfigurasi,
      mulai: ev.diubah_pada,
      selesai: null,
      alasanSelesai: null,
      diubahOleh: null,
      perkiraan,
    }
  }

  for (const ev of sorted) {
    const aktif = isAktif(ev)
    if (ev.aksi === 'dihapus') {
      tutup(ev.diubah_pada, 'dihapus', ev.diubah_oleh)
      continue
    }
    if (!aktif) {
      if (buka) tutup(ev.diubah_pada, ev.aksi === 'dilepas' || !ev.is_assigned ? 'dilepas' : 'dimatikan', ev.diubah_oleh)
      continue
    }
    if (buka) {
      // Promo aktif yang konfigurasinya diubah: periode lama selesai di sini.
      if (promoConfigSignature(buka.konfigurasi) === promoConfigSignature(ev.konfigurasi)) continue
      tutup(ev.diubah_pada, 'diubah', ev.diubah_oleh)
    }
    // Baris 'awal' yang sudah aktif: jam nyala sebenarnya tak tercatat, jadi
    // tanggal baris dibuat dipakai sebagai perkiraan.
    mulai(ev, ev.aksi === 'awal')
  }
  if (buka) result.push(buka)
  return result
}

/**
 * Susun riwayat lengkap. `now` dipakai untuk menentukan promo aktif yang
 * jadwalnya sudah lewat (masih menyala di DB tapi tidak berlaku lagi).
 */
export function susunRiwayatPromo(
  rows: RiwayatRow[],
  pemakaian: PemakaianMap,
  now: number = Date.now(),
): RiwayatEntry[] {
  const perBaris = new Map<string, RiwayatRow[]>()
  for (const row of rows) {
    const list = perBaris.get(row.promo_row_id)
    if (list) list.push(row)
    else perBaris.set(row.promo_row_id, [row])
  }

  const periode: Periode[] = []
  for (const [rowId, events] of perBaris) {
    const tercatat = periodeBaris(events)
    periode.push(...tercatat)

    // Hanya baris yang SUDAH ADA sebelum riwayat dicatat (punya kejadian
    // 'awal') yang boleh punya periode perkiraan. Pemakaiannya yang terjadi
    // sebelum kejadian tercatat pertama = masa sebelum riwayat dicatat; dari
    // situ disusun satu periode perkiraan (pakai pertama s.d. pakai terakhir)
    // supaya promo lama tetap tampil dengan jamnya. Pemakaian di luar periode
    // SESUDAH pencatatan dimulai (mis. pesanan offline yang tersinkron telat)
    // tidak boleh melahirkan promo "lama" palsu.
    const awal = events.find(e => e.aksi === 'awal') || events[0]
    const kejadianTercatat = events.filter(e => e.aksi !== 'awal').map(e => ms(e.diubah_pada))
    const mulaiDicatat = kejadianTercatat.length > 0 ? Math.min(...kejadianTercatat) : Infinity
    const sisa =
      awal.aksi === 'awal'
        ? (pemakaian[rowId] || []).filter(
            waktu =>
              ms(waktu) < mulaiDicatat &&
              !tercatat.some(p => p.perkiraan && ms(waktu) >= ms(p.mulai) && (p.selesai === null || ms(waktu) <= ms(p.selesai))),
          )
        : []
    const pernahAktifTercatat = tercatat.length > 0
    if (sisa.length > 0) {
      const urut = [...sisa].sort((a, b) => ms(a) - ms(b))
      periode.push({
        rowId,
        outletId: awal.outlet_id,
        scope: awal.scope,
        menuItemId: awal.menu_item_id,
        konfigurasi: awal.konfigurasi,
        mulai: urut[0],
        selesai: urut[urut.length - 1],
        alasanSelesai: null,
        diubahOleh: null,
        perkiraan: true,
        waktuPakai: urut,
      })
    } else if (!pernahAktifTercatat && sisa.length === 0 && awal.aksi === 'awal') {
      // Promo lama yang tidak aktif dan tak pernah tercatat dipakai.
      periode.push({
        rowId,
        outletId: awal.outlet_id,
        scope: awal.scope,
        menuItemId: awal.menu_item_id,
        konfigurasi: awal.konfigurasi,
        mulai: null,
        selesai: null,
        alasanSelesai: null,
        diubahOleh: null,
        perkiraan: true,
        dibuat: awal.diubah_pada,
      })
    }
  }

  // Pemakaian per periode. Tiap waktu pakai hanya masuk ke SATU periode
  // (yang pertama cocok) supaya tak terhitung dua kali.
  const sudahDipakai = new Set<string>()
  for (const p of periode) {
    if (p.waktuPakai) {
      for (const waktu of p.waktuPakai) sudahDipakai.add(`${p.rowId}|${waktu}`)
      continue
    }
    p.waktuPakai = (pemakaian[p.rowId] || []).filter(waktu => {
      if (p.mulai === null || sudahDipakai.has(`${p.rowId}|${waktu}`)) return false
      const t = ms(waktu)
      const cocok = t >= ms(p.mulai) && (p.selesai === null || t <= ms(p.selesai))
      if (cocok) sudahDipakai.add(`${p.rowId}|${waktu}`)
      return cocok
    })
  }

  // Periode yang masih terbuka tapi jadwalnya sudah lewat = sudah selesai.
  for (const p of periode) {
    if (p.selesai !== null || p.mulai === null) continue
    if (getPromoStatus({ ...p.konfigurasi, is_active: true }, now) === 'berakhir') {
      p.selesai = p.konfigurasi.end_date
      p.alasanSelesai = 'jadwal_selesai'
    }
  }

  const entries = new Map<string, RiwayatEntry>()
  for (const p of periode) {
    const aktif = p.mulai !== null && p.selesai === null
    const sig = `${promoOutletKey({ scope: p.scope, menu_item_id: p.menuItemId })}|${promoConfigSignature(p.konfigurasi)}`
    // Periode pasti dari satu kali Simpan punya jam identik di semua outlet.
    // Yang aktif & yang perkiraan digabung per promo saja (jamnya beda-beda
    // per outlet karena baris dibuat di waktu berbeda).
    const key = aktif
      ? `aktif|${sig}`
      : p.perkiraan
        ? `lama|${p.mulai === null ? 'kosong' : 'dipakai'}|${sig}`
        : `selesai|${sig}|${ms(p.mulai)}|${ms(p.selesai)}|${p.alasanSelesai}`

    let entry = entries.get(key)
    if (!entry) {
      entry = {
        id: key,
        status: aktif ? 'aktif' : 'selesai',
        scope: p.scope,
        menuItemId: p.menuItemId,
        konfigurasi: p.konfigurasi,
        outletIds: [],
        mulai: p.mulai ?? p.dibuat ?? null,
        selesai: p.selesai,
        alasanSelesai: p.alasanSelesai,
        diubahOleh: p.diubahOleh,
        perkiraan: p.perkiraan,
        dipakai: 0,
        pakaiPertama: null,
        pakaiTerakhir: null,
      }
      entries.set(key, entry)
    } else {
      // Gabungan per promo: mulai paling awal, selesai paling akhir.
      const mulai = p.mulai ?? p.dibuat ?? null
      if (mulai && (!entry.mulai || ms(mulai) < ms(entry.mulai))) entry.mulai = mulai
      if (entry.status === 'selesai' && p.selesai && (!entry.selesai || ms(p.selesai) > ms(entry.selesai))) entry.selesai = p.selesai
      if (p.perkiraan && !entry.perkiraan) entry.perkiraan = true
    }
    if (p.outletId && !entry.outletIds.includes(p.outletId)) entry.outletIds.push(p.outletId)

    for (const waktu of p.waktuPakai || []) {
      entry.dipakai += 1
      if (!entry.pakaiPertama || ms(waktu) < ms(entry.pakaiPertama)) entry.pakaiPertama = waktu
      if (!entry.pakaiTerakhir || ms(waktu) > ms(entry.pakaiTerakhir)) entry.pakaiTerakhir = waktu
    }
  }

  // Terbaru di atas: yang aktif dulu, lalu yang selesai paling akhir.
  return [...entries.values()]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'aktif' ? -1 : 1
      const ta = ms(a.selesai ?? a.mulai) || 0
      const tb = ms(b.selesai ?? b.mulai) || 0
      return tb - ta
    })
}
