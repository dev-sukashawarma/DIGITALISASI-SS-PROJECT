// Laporan kiriman surat jalan per vendor. Spec: docs/superpowers/specs/2026-09-14-laporan-kiriman-vendor-design.md
// Penjaga akses sebenarnya di RPC (_cek_laporan_kiriman_vendor); daftar role WAJIB sama.
export const ROLE_LAPORAN_KIRIMAN_VENDOR = ['kitchen', 'purchasing', 'admin', 'owner', 'admin_finance', 'spv', 'regional_manager'] as const

export function canLihatKirimanVendor(role: string | null | undefined): boolean {
  return (ROLE_LAPORAN_KIRIMAN_VENDOR as readonly string[]).includes(role ?? '')
}

export type BarisRincian = {
  surat_jalan_item_id: string; surat_jalan_id: string; tanggal: string; document_number: string | null; status: string
  outlet_id: string; outlet_nama: string; outlet_tes: boolean; bahan_baku_id: string; bahan_nama: string; satuan: string
  vendor_id: string | null; vendor_nama: string | null; vendor_otomatis: boolean
  qty_dikirim: number; qty_terima: number | null; qty_acuan: number; belum_diterima: boolean
  harga: number | null; nilai: number | null; total_count: number
}

export type BarisRekap = {
  vendor_id: string | null; vendor_nama: string | null; bahan_baku_id: string; bahan_nama: string; satuan: string
  outlet_id: string; outlet_nama: string; qty: number; nilai: number | null; harga_rata: number | null
  jumlah_sj: number; ada_belum_diterima: boolean
}

export type KelompokBahan = { bahan_baku_id: string; bahan_nama: string; satuan: string; qty: number; nilai: number; outlet: BarisRekap[] }
export type KelompokVendor = { vendor_id: string | null; vendor_nama: string; nilai: number; bahan: KelompokBahan[] }
export type RingkasanRekap = { total: number; vendor: KelompokVendor[] }

export function labelVendor(nama: string | null, otomatis: boolean): string {
  if (!nama) return 'Belum tercatat'
  return otomatis ? `${nama} (katalog)` : nama
}

const tanggalWib = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)

export function rentangDefault(now: Date): { dari: string; sampai: string } {
  const sampai = tanggalWib(now)
  const dari = new Date(`${sampai}T00:00:00Z`)
  dari.setUTCDate(dari.getUTCDate() - 6)
  return { dari: dari.toISOString().slice(0, 10), sampai }
}

export function kelompokkanRekap(rows: BarisRekap[]): RingkasanRekap {
  const vendors = new Map<string, KelompokVendor>()
  for (const row of rows) {
    const vk = row.vendor_id ?? '__kosong__'
    let v = vendors.get(vk)
    if (!v) { v = { vendor_id: row.vendor_id, vendor_nama: labelVendor(row.vendor_nama, false), nilai: 0, bahan: [] }; vendors.set(vk, v) }
    let b = v.bahan.find((x) => x.bahan_baku_id === row.bahan_baku_id)
    if (!b) { b = { bahan_baku_id: row.bahan_baku_id, bahan_nama: row.bahan_nama, satuan: row.satuan, qty: 0, nilai: 0, outlet: [] }; v.bahan.push(b) }
    b.qty += Number(row.qty ?? 0)
    b.nilai += Number(row.nilai ?? 0)
    b.outlet.push(row)
    v.nilai += Number(row.nilai ?? 0)
  }
  const vendor = [...vendors.values()].sort((a, b) =>
    (a.vendor_id === null ? 1 : 0) - (b.vendor_id === null ? 1 : 0) || a.vendor_nama.localeCompare(b.vendor_nama))
  for (const v of vendor) v.bahan.sort((a, b) => a.bahan_nama.localeCompare(b.bahan_nama))
  return { total: vendor.reduce((s, v) => s + v.nilai, 0), vendor }
}
