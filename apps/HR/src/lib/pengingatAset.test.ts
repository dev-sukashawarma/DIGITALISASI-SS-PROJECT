import { describe, expect, it } from 'vitest'
import {
  ambangHari,
  batalkanTindakLanjut,
  buatTindakLanjut,
  formatSisa,
  nilaiAset,
  susunPengingat,
  tambahBulan,
  type BarisPengingat,
} from './pengingatAset'

const TODAY = '2026-09-29'

function baris(over: Partial<BarisPengingat> = {}): BarisPengingat {
  return {
    outlet_id: 'o1',
    outlet_name: 'EMPANG',
    master_item_id: 'm1',
    item_name: 'FREEZER',
    subsection: 'Penyimpanan',
    umur_ekonomis_bulan: 72,
    purchase_date: '2024-01-01',
    kondisi: 'baik',
    observed_qty: 1,
    is_present: null,
    brand: 'GEA',
    catatan: null,
    dilaporkan_oleh: 'Abu Bakar',
    dilaporkan_at: '2026-09-06T17:52:00+07:00',
    tl_umur_keputusan: null,
    tl_umur_ingatkan_lagi: null,
    tl_umur_acuan_tanggal: null,
    tl_umur_catatan: null,
    tl_umur_oleh: null,
    tl_umur_at: null,
    tl_kondisi_keputusan: null,
    tl_kondisi_ingatkan_lagi: null,
    tl_kondisi_acuan: null,
    tl_kondisi_catatan: null,
    tl_kondisi_oleh: null,
    tl_kondisi_at: null,
    ...over,
  }
}

describe('tanggal', () => {
  it('menjepit ke akhir bulan', () => {
    expect(tambahBulan('2024-01-31', 1)).toBe('2024-02-29')
    expect(tambahBulan('2025-01-31', 1)).toBe('2025-02-28')
    expect(tambahBulan('2020-03-15', 72)).toBe('2026-03-15')
  })
  it('ambang = min(90 hari, 25% umur)', () => {
    expect(ambangHari(72)).toBe(90)
    expect(ambangHari(12)).toBe(90)
    expect(ambangHari(6)).toBe(45)
  })
  it('format sisa', () => {
    expect(formatSisa(-3)).toBe('lewat 3 hari')
    expect(formatSisa(45)).toBe('45 hari lagi')
    expect(formatSisa(-120)).toBe('lewat 4 bulan')
    expect(formatSisa(0)).toBe('habis hari ini')
  })
})

describe('penilaian umur', () => {
  it('aman bila jauh dari jatuh tempo', () => {
    const a = nilaiAset(baris(), TODAY)
    expect(a.kategori).toBe('aman')
    expect(a.jatuhTempo).toBe('2030-01-01')
  })
  it('segera bila sisa ≤ ambang', () => {
    // 2020-12-01 + 72 bln = 2026-12-01 → 63 hari lagi
    const a = nilaiAset(baris({ purchase_date: '2020-12-01' }), TODAY)
    expect(a.sisaHari).toBe(63)
    expect(a.alasan).toEqual(['segera'])
    expect(a.kategori).toBe('perlu_tindakan')
  })
  it('tepat di batas ambang masih "segera", sehari sebelumnya aman', () => {
    // jatuh tempo 2026-12-28 = 90 hari lagi
    expect(nilaiAset(baris({ purchase_date: '2020-12-28' }), TODAY).alasan).toEqual(['segera'])
    expect(nilaiAset(baris({ purchase_date: '2020-12-29' }), TODAY).kategori).toBe('aman')
  })
  it('lewat umur', () => {
    const a = nilaiAset(baris({ umur_ekonomis_bulan: 12, purchase_date: '2025-01-10' }), TODAY)
    expect(a.alasan).toEqual(['lewat_umur'])
    expect(a.sisaHari).toBeLessThan(0)
  })
  it('tanggal beli kosong → daftar data belum lengkap', () => {
    const a = nilaiAset(baris({ purchase_date: null }), TODAY)
    expect(a.kategori).toBe('tanggal_kosong')
    expect(a.tanggalKosong).toBe(true)
  })
  it('barang tak dilacak umurnya & kondisi baik → tidak_dilacak', () => {
    expect(nilaiAset(baris({ umur_ekonomis_bulan: null }), TODAY).kategori).toBe('tidak_dilacak')
  })
  it('barang tidak ada di outlet tidak dinilai', () => {
    expect(nilaiAset(baris({ kondisi: 'tidak_ada', purchase_date: null }), TODAY).kategori).toBe('tidak_dilacak')
    expect(nilaiAset(baris({ observed_qty: 0, purchase_date: '2010-01-01' }), TODAY).kategori).toBe('tidak_dilacak')
    expect(nilaiAset(baris({ is_present: false, observed_qty: null }), TODAY).kategori).toBe('tidak_dilacak')
  })
})

describe('penilaian kondisi', () => {
  it('rusak & perlu perbaikan langsung perlu tindakan, walau umur masih panjang', () => {
    expect(nilaiAset(baris({ kondisi: 'rusak' }), TODAY).alasan).toEqual(['rusak'])
    expect(nilaiAset(baris({ kondisi: 'perlu_perbaikan', umur_ekonomis_bulan: null }), TODAY).alasan).toEqual(['perbaikan'])
  })
  it('rusak + lewat umur → dua alasan, rusak didahulukan', () => {
    const a = nilaiAset(baris({ kondisi: 'rusak', umur_ekonomis_bulan: 12, purchase_date: '2020-01-01' }), TODAY)
    expect(a.alasan).toEqual(['rusak', 'lewat_umur'])
    expect(a.prioritas).toBe(0)
  })
})

describe('tindak lanjut', () => {
  it('menyembunyikan pengingat sampai ingatkan_lagi selama data acuan sama', () => {
    const a = nilaiAset(baris({
      kondisi: 'rusak',
      tl_kondisi_keputusan: 'diperbaiki',
      tl_kondisi_ingatkan_lagi: '2026-10-29',
      tl_kondisi_acuan: 'rusak',
    }), TODAY)
    expect(a.kategori).toBe('ditindaklanjuti')
    expect(a.alasan).toEqual([])
    expect(a.ditindaklanjuti[0].keputusan).toBe('diperbaiki')
  })
  it('muncul lagi bila tenggat cek ulang sudah lewat & data belum berubah', () => {
    const a = nilaiAset(baris({
      kondisi: 'rusak',
      tl_kondisi_keputusan: 'diperbaiki',
      tl_kondisi_ingatkan_lagi: TODAY,
      tl_kondisi_acuan: 'rusak',
    }), TODAY)
    expect(a.alasan).toEqual(['rusak'])
  })
  it('data acuan berubah → catatan lama tidak berlaku', () => {
    // HR tandai "diganti", AM memperbarui tanggal beli → dinilai dari data baru (aman).
    const a = nilaiAset(baris({
      purchase_date: '2026-09-01',
      tl_umur_keputusan: 'diganti',
      tl_umur_ingatkan_lagi: '2026-10-20',
      tl_umur_acuan_tanggal: '2020-01-01',
    }), TODAY)
    expect(a.kategori).toBe('aman')
    // Kondisi berubah perlu_perbaikan → rusak: pengingat muncul lagi.
    const b = nilaiAset(baris({
      kondisi: 'rusak',
      tl_kondisi_keputusan: 'ditunda',
      tl_kondisi_ingatkan_lagi: '2027-01-01',
      tl_kondisi_acuan: 'perlu_perbaikan',
    }), TODAY)
    expect(b.alasan).toEqual(['rusak'])
  })
  it('tindak lanjut satu pemicu tidak menyembunyikan pemicu lain', () => {
    const a = nilaiAset(baris({
      kondisi: 'rusak',
      umur_ekonomis_bulan: 12,
      purchase_date: '2020-01-01',
      tl_kondisi_keputusan: 'diperbaiki',
      tl_kondisi_ingatkan_lagi: '2026-10-29',
      tl_kondisi_acuan: 'rusak',
    }), TODAY)
    expect(a.alasan).toEqual(['lewat_umur'])
    expect(a.kategori).toBe('perlu_tindakan')
  })
  it('buatTindakLanjut: satu baris per pemicu dengan snapshot & tenggat', () => {
    const a = nilaiAset(baris({ kondisi: 'rusak', umur_ekonomis_bulan: 12, purchase_date: '2020-01-01' }), TODAY)
    const rows = buatTindakLanjut(a, 'diganti', TODAY, { catatan: '  unit baru  ' })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.pemicu === 'umur')).toMatchObject({ acuan_tanggal_beli: '2020-01-01', acuan_kondisi: null, ingatkan_lagi: '2026-10-29', catatan: 'unit baru' })
    expect(rows.find((r) => r.pemicu === 'kondisi')).toMatchObject({ acuan_kondisi: 'rusak', acuan_tanggal_beli: null })
    expect(buatTindakLanjut(a, 'ditunda', TODAY, { tundaHari: 90 })[0].ingatkan_lagi).toBe('2026-12-28')
  })
  it('hasil buatTindakLanjut memang menyembunyikan pengingatnya (round-trip)', () => {
    const row = baris({ kondisi: 'perlu_perbaikan' })
    const [tl] = buatTindakLanjut(nilaiAset(row, TODAY), 'diperbaiki', TODAY)
    const setelah = nilaiAset({ ...row, tl_kondisi_keputusan: tl.keputusan, tl_kondisi_ingatkan_lagi: tl.ingatkan_lagi, tl_kondisi_acuan: tl.acuan_kondisi }, TODAY)
    expect(setelah.kategori).toBe('ditindaklanjuti')
    const [batal] = batalkanTindakLanjut(setelah, TODAY)
    const lagi = nilaiAset({ ...row, tl_kondisi_keputusan: batal.keputusan, tl_kondisi_ingatkan_lagi: batal.ingatkan_lagi, tl_kondisi_acuan: batal.acuan_kondisi }, TODAY)
    expect(lagi.kategori).toBe('perlu_tindakan')
  })
})

describe('susunPengingat', () => {
  it('mengurutkan rusak dulu, lalu lewat umur, lalu sisa hari terkecil', () => {
    const r = susunPengingat([
      baris({ master_item_id: 'a', item_name: 'SEGERA', purchase_date: '2020-12-01' }),
      baris({ master_item_id: 'b', item_name: 'RUSAK', kondisi: 'rusak' }),
      baris({ master_item_id: 'c', item_name: 'LEWAT', umur_ekonomis_bulan: 12, purchase_date: '2024-01-01' }),
      baris({ master_item_id: 'd', item_name: 'KOSONG', purchase_date: null }),
      baris({ master_item_id: 'e', item_name: 'AMAN' }),
    ], TODAY)
    expect(r.perluTindakan.map((a) => a.itemName)).toEqual(['RUSAK', 'LEWAT', 'SEGERA'])
    expect(r.tanggalKosong.map((a) => a.itemName)).toEqual(['KOSONG'])
    expect(r.hitung).toEqual({ rusak: 1, lewat_umur: 1, perbaikan: 0, segera: 1 })
  })
})
