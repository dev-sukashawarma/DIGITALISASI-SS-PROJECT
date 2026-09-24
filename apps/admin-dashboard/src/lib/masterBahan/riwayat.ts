import { rupiah } from '@/lib/format'

/** Satu baris view riwayat_master_bahan (Tahap 1). */
export type BarisRiwayat = {
  bahan_baku_id: string | null
  changed_at: string
  changed_by: string | null
  jenis: 'data' | 'harga_master' | 'harga_vendor'
  tabel: string
  aksi: string
  perubahan: Record<string, unknown> | null
  alasan: string | null
  harga_lama: number | null
  harga_baru: number | null
  supplier_id: string | null
}

const LABEL: Record<string, string> = {
  nama: 'Nama', merek: 'Merek', kategori: 'Kategori', peruntukan: 'Peruntukan', is_opname: 'Ikut opname',
  default_reorder_point: 'Batas minimum', satuan: 'Satuan besar', satuan_tengah: 'Satuan tengah',
  faktor_tengah: 'Isi tengah per besar', satuan_kecil: 'Satuan kecil', faktor_tampilan: 'Isi kecil per besar',
  faktor_konversi: 'Isi kecil per tengah', satuan_po: 'Satuan PO', satuan_distribusi: 'Satuan distribusi',
  is_active: 'Aktif', image_url: 'Foto besar', image_url_tengah: 'Foto tengah', image_url_kecil: 'Foto kecil',
  image_urls: 'Galeri foto', nama_kemasan: 'Nama kemasan', qty_isi: 'Isi kemasan', harga_beli: 'Harga SKU',
  is_default: 'SKU default', kontak: 'Kontak', alamat: 'Alamat', catatan: 'Catatan', termin_hari: 'Termin (hari)',
  vendor_induk_id: 'Vendor induk', bahan_baku_ids: 'Bahan yang dipasok',
}

const AWALAN: Record<string, string> = { bahan_baku: '', bahan_baku_sku: 'SKU', supplier: 'Supplier' }

function nilai(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak'
  if (Array.isArray(v)) return `${v.length} item`
  return String(v)
}

function harga(v: number | null): string {
  return v === null || v === undefined ? '—' : rupiah(Number(v))
}

export function ringkasRiwayat(r: BarisRiwayat): string[] {
  if (r.jenis === 'harga_master') return [`Harga master: ${harga(r.harga_lama)} → ${harga(r.harga_baru)}`]
  if (r.jenis === 'harga_vendor') {
    const p = r.perubahan ?? {}
    const baris = [`Harga vendor: ${harga(r.harga_lama)} → ${harga(r.harga_baru)}`]
    if (p.satuan_beli) baris.push(`Per ${nilai(p.satuan_beli)} (isi ${nilai(p.isi_satuan_kecil)}), sumber ${nilai(p.sumber)}`)
    return baris
  }
  const awalan = AWALAN[r.tabel] ?? ''
  if (r.aksi === 'INSERT') return [awalan ? `${awalan} dibuat` : 'Dibuat']
  if (r.aksi === 'DELETE') return [awalan ? `${awalan} dihapus` : 'Dihapus']
  const p = (r.perubahan ?? {}) as Record<string, { lama?: unknown; baru?: unknown }>
  return Object.entries(p).map(
    ([k, d]) => `${awalan ? `${awalan} ` : ''}${LABEL[k] ?? k}: ${nilai(d?.lama)} → ${nilai(d?.baru)}`,
  )
}
