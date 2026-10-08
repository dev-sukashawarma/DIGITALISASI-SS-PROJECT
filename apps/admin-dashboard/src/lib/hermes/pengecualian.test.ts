import { cariPelanggaran } from './pengecualian'

describe('pengecualian data per app (spec §3)', () => {
  it('NIK, nomor HP, token, rekening ditolak di semua app', () => {
    for (const teks of ['{"nik":"3201"}', '{"hp":"081234567890"}', '{"token":"x"}', '{"rekening":"123"}']) {
      expect(cariPelanggaran(teks, 'penjualan_ringkasan', 'penjualan'), teks).not.toBeNull()
      expect(cariPelanggaran(teks, 'status_app', 'sistem'), teks).not.toBeNull()
    }
  })
  it('gaji & kasbon per orang hanya lolos di hr_rinci', () => {
    expect(cariPelanggaran('{"gaji_pokok":1}', 'absensi_rekap', 'absensi')).not.toBeNull()
    expect(cariPelanggaran('{"kasbon":1}', 'absensi_rekap', 'absensi')).not.toBeNull()
    expect(cariPelanggaran('{"gaji_pokok":1,"kasbon":1}', 'gaji_daftar', 'hr_rinci')).toBeNull()
  })
  it('kasbon_ringkasan boleh menyebut kasbon (agregat), tapi tidak gaji', () => {
    expect(cariPelanggaran('{"kasbon_menunggu":3}', 'kasbon_ringkasan', 'absensi')).toBeNull()
    expect(cariPelanggaran('{"gaji":1}', 'kasbon_ringkasan', 'absensi')).not.toBeNull()
  })
  it('data pelanggan ditolak di penjualan & app_retail', () => {
    expect(cariPelanggaran('{"nama_pelanggan":"X"}', 'penjualan_ringkasan', 'penjualan')).not.toBeNull()
    expect(cariPelanggaran('{"alamat":"Jl"}', 'pesanan_aplikasi', 'app_retail')).not.toBeNull()
  })
  it('bukti transfer ditolak di finance', () => {
    expect(cariPelanggaran('{"bukti_transfer":"url"}', 'utang_po', 'finance')).not.toBeNull()
  })
  it('keluaran wajar lolos', () => {
    expect(cariPelanggaran('{"omzet_kotor":1000,"transaksi":5,"outlet":"EMPANG"}', 'penjualan_ringkasan', 'penjualan')).toBeNull()
  })
})
