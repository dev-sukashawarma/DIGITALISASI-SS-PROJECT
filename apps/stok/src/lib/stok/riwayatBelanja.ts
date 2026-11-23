// Perhitungan riwayat belanja outlet (Plafon & Belanja Outlet).
//
// Aturan skala (lihat memory "basis-harga-kanonik-satuan-besar"):
//   - permintaan_bahan_item.qty_disetujui / qty_diminta tersimpan dalam SATUAN BESAR
//   - harga_snapshot = harga per SATUAN BESAR
// Jadi nilai rupiah = qty_disetujui × harga_snapshot, persis rumus RPC
// get_outlet_budget_status (kolom "terpakai"). Satuan distribusi hanya untuk
// TAMPILAN — dulu qty dikonversi ke distribusi lalu dikali harga per satuan besar,
// sehingga nilainya membengkak sebesar faktor distribusi (±5× di Cimanggu).
import { getDistribusiFactor } from '@/lib/format/compositeUnit'

type BahanSatuan = Parameters<typeof getDistribusiFactor>[0]

export interface BarisBelanja {
  qtyDisetujuiDistribusi: number
  qtyDimintaDistribusi: number
  /** Harga per SATUAN DISTRIBUSI — supaya berdampingan dengan qty distribusi. */
  hargaPerDistribusi: number
  /** Nilai rupiah baris = qty_disetujui (besar) × harga_snapshot (per besar). */
  subtotal: number
}

export function hitungBarisBelanja(input: {
  qtyDisetujui: number | null | undefined
  qtyDiminta: number | null | undefined
  hargaSnapshot: number | null | undefined
  bahan: BahanSatuan | null | undefined
}): BarisBelanja {
  const qtyDisetujui = Number(input.qtyDisetujui ?? 0)
  const qtyDiminta = Number(input.qtyDiminta ?? 0)
  const harga = Number(input.hargaSnapshot ?? 0)
  const faktor = input.bahan ? getDistribusiFactor(input.bahan) || 1 : 1

  return {
    qtyDisetujuiDistribusi: qtyDisetujui * faktor,
    qtyDimintaDistribusi: qtyDiminta * faktor,
    hargaPerDistribusi: harga / faktor,
    subtotal: qtyDisetujui * harga,
  }
}

/**
 * Batas timestamp untuk rentang tanggal (YYYY-MM-DD) dalam hari WIB.
 * RPC menghitung periode dengan (updated_at AT TIME ZONE 'Asia/Jakarta')::date,
 * jadi filter riwayat wajib memakai batas +07:00, bukan Z (UTC).
 */
export function batasHariWib(
  dari: string | null | undefined,
  sampai: string | null | undefined
): { dari: string | null; sampai: string | null } {
  return {
    dari: dari ? `${dari}T00:00:00.000+07:00` : null,
    sampai: sampai ? `${sampai}T23:59:59.999+07:00` : null,
  }
}

const formatTanggalWib = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Tanggal (YYYY-MM-DD) menurut kalender WIB. */
export function tanggalWib(d: Date = new Date()): string {
  return formatTanggalWib.format(d)
}

/** Tanggal 1 bulan berjalan menurut kalender WIB. */
export function awalBulanWib(d: Date = new Date()): string {
  return `${tanggalWib(d).slice(0, 7)}-01`
}
