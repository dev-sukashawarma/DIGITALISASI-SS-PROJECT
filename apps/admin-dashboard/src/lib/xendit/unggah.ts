import type { BarisXendit } from './balanceHistory'
import { cocokkanNominalJam } from './cocokkan'
import { isPesananWebsite } from './website'
import { biayaProses, mdrSeharusnya } from './tarif'

/** Baris tabel xendit_pembayaran (kolom yang dipakai di sini). */
export type BarisDb = {
  xendit_id: string
  xendit_ref?: string | null
  ref_qris?: string | null
  nominal: number
  dibayar_at: string
  channel?: string | null
  external_order_id?: string | null
  cara_cocok?: string | null
  bukan_penjualan?: boolean
  outlet_id?: string | null
  sumber?: string
  nama_file?: string | null
  diimpor_oleh?: string | null
  biaya_mdr?: number | null
  biaya_proses?: number | null
}

export type PesananDb = { external_order_id: string; total_amount: number; created_at: string; outlet_id: string; sales_source: string | null }

/** Akses database yang dibutuhkan proses unggah — diisi Supabase di server action. */
export interface DbXendit {
  ambilPembayaran(xenditIds: string[]): Promise<BarisDb[]>
  sisipkan(rows: BarisDb[]): Promise<void>
  /** Hanya kolom data file; tidak pernah menyentuh tautan (external_order_id, cara_cocok, outlet_id, sumber). */
  perbarui(rows: Pick<BarisDb, 'xendit_id' | 'xendit_ref' | 'ref_qris' | 'nominal' | 'dibayar_at' | 'channel' | 'bukan_penjualan' | 'nama_file' | 'biaya_mdr' | 'biaya_proses'>[]): Promise<void>
  ambilPesananWebsite(dariIso: string, sampaiIso: string): Promise<PesananDb[]>
  externalTertaut(externalIds: string[]): Promise<Set<string>>
  tautkan(rows: { xendit_id: string; external_order_id: string; outlet_id: string; cara_cocok: 'file_nominal_jam' }[]): Promise<void>
  /** Biaya MDR untuk pembayaran yang sudah ada di database tetapi tidak ada di file ini. */
  perbaruiBiaya(rows: { xendit_id: string; biaya_mdr: number }[]): Promise<void>
}

export type RingkasanUnggah = {
  baru: number; diperbarui: number; cocokId: number; cocokNominalJam: number; belumCocok: number; bukanPenjualan: number
  /** Jumlah tagihan Processing Fee di file (informasi; jatuh sehari sesudah bayar/settlement). */
  tagihanProses: number
  /** Pembayaran di file yang kena Processing Fee (tanggal bayar ≥ 1 Okt 2026). */
  pembayaranBerbiayaProses: number
}

export type BiayaFile = { mdrPerTransaksi: Record<string, number>; tagihanProses: number }

const JAM_MS = 60 * 60_000

export async function prosesUnggahXendit(
  db: DbXendit,
  baris: BarisXendit[],
  meta: { namaFile: string; userId: string },
  biaya: BiayaFile = { mdrPerTransaksi: {}, tagihanProses: 0 },
): Promise<RingkasanUnggah> {
  const ada = new Map((await db.ambilPembayaran(baris.map(b => b.xenditId))).map(r => [r.xendit_id, r]))

  const dataFile = (b: BarisXendit) => ({
    xendit_id: b.xenditId, xendit_ref: b.xenditRef, ref_qris: b.refQris, nominal: b.nominal,
    dibayar_at: b.dibayarAt, channel: b.channel, bukan_penjualan: b.bukanPenjualan, nama_file: meta.namaFile,
    biaya_proses: biayaProses(b.dibayarAt),
    // MDR dari file; 0 bila memang tak kena MDR; null = seharusnya ada tapi tak ditemukan (laporan pakai estimasi).
    biaya_mdr: biaya.mdrPerTransaksi[b.xenditId] ?? (mdrSeharusnya(b.nominal, b.channel, b.dibayarAt) === 0 ? 0 : null),
  })
  const baru = baris.filter(b => !ada.has(b.xenditId))
  const lama = baris.filter(b => ada.has(b.xenditId))
  if (baru.length) await db.sisipkan(baru.map(b => ({ ...dataFile(b), sumber: 'file', diimpor_oleh: meta.userId })))
  if (lama.length) await db.perbarui(lama.map(dataFile))

  // Baris biaya yang pembayarannya tak ada di file ini (mis. dibayar di periode file sebelumnya).
  const diFile = new Set(baris.map(b => b.xenditId))
  const idBiayaLuar = Object.keys(biaya.mdrPerTransaksi).filter(id => !diFile.has(id))
  if (idBiayaLuar.length) {
    const diDb = await db.ambilPembayaran(idBiayaLuar)
    if (diDb.length) await db.perbaruiBiaya(diDb.map(r => ({ xendit_id: r.xendit_id, biaya_mdr: biaya.mdrPerTransaksi[r.xendit_id] })))
  }

  // Pembayaran penjualan yang belum punya pesanan → coba cocokkan lewat nominal + jam.
  const belum = baris.filter(b => !b.bukanPenjualan && !ada.get(b.xenditId)?.external_order_id)
  let cocok = new Map<string, string>()
  const outletPesanan = new Map<string, string>()
  if (belum.length) {
    const waktu = belum.map(b => Date.parse(b.dibayarAt))
    const pesanan = (await db.ambilPesananWebsite(
      new Date(Math.min(...waktu) - JAM_MS).toISOString(),
      new Date(Math.max(...waktu) + JAM_MS).toISOString(),
    )).filter(isPesananWebsite)
    pesanan.forEach(p => outletPesanan.set(p.external_order_id, p.outlet_id))
    const tertaut = await db.externalTertaut(pesanan.map(p => p.external_order_id))
    cocok = cocokkanNominalJam(
      belum.map(b => ({ xenditId: b.xenditId, nominal: b.nominal, dibayarAt: b.dibayarAt })),
      pesanan.map(p => ({ externalOrderId: p.external_order_id, total: Number(p.total_amount), createdAt: p.created_at })),
      tertaut,
    )
    if (cocok.size) {
      await db.tautkan([...cocok].map(([xendit_id, external_order_id]) => ({
        xendit_id, external_order_id, outlet_id: outletPesanan.get(external_order_id)!, cara_cocok: 'file_nominal_jam' as const,
      })))
    }
  }

  return {
    baru: baru.length,
    diperbarui: lama.length,
    cocokId: 0, // belum ada ID penghubung file ↔ pesanan (spec §5.2, Task 0)
    cocokNominalJam: cocok.size,
    belumCocok: belum.length - cocok.size,
    bukanPenjualan: baris.filter(b => b.bukanPenjualan).length,
    tagihanProses: biaya.tagihanProses,
    pembayaranBerbiayaProses: baris.filter(b => biayaProses(b.dibayarAt) > 0).length,
  }
}
