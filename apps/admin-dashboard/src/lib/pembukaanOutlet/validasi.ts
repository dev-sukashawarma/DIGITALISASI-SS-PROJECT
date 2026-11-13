import type { InputWizard } from './types'

export type KunciGalat = keyof InputWizard | 'mitra.akun'

export type HasilValidasi = { ok: true } | { ok: false; galat: Partial<Record<KunciGalat, string>> }

/** Cermin aturan RPC buat_outlet_persiapan; DB tetap penjaga terakhir. */
export function validasiInputWizard(input: InputWizard, hariIni: string): HasilValidasi {
  const galat: Partial<Record<KunciGalat, string>> = {}

  if (!input.nama.trim()) galat.nama = 'Nama outlet wajib diisi'
  if (!input.amStaffId) galat.amStaffId = 'Pilih Area Manager'
  if (input.jamBuka && input.jamTutup && input.jamTutup <= input.jamBuka) {
    galat.jamTutup = 'Jam tutup harus setelah jam buka'
  }
  if (input.tanggalGrandOpening && input.tanggalGrandOpening < hariIni) {
    galat.tanggalGrandOpening = 'Tanggal grand opening tidak boleh sebelum hari ini'
  }

  if (input.jenis === 'internal') {
    if (input.mitra) galat.mitra = 'Data investasi hanya untuk outlet Mitra'
    if (input.rab) galat.rab = 'Masa RAB hanya untuk outlet Mitra'
  } else {
    if (!input.mitra) {
      galat.mitra = 'Data investasi mitra wajib diisi'
    } else {
      const { akun } = input.mitra
      if (!(input.mitra.nilaiInvestasi >= 0)) galat.mitra = 'Nilai investasi tidak valid'
      if (akun.mode === 'baru') {
        if (!akun.username.trim()) galat['mitra.akun'] = 'Username akun mitra wajib diisi'
        else if (akun.password.length < 8) galat['mitra.akun'] = 'Password sementara minimal 8 karakter'
      } else if (!akun.userId) {
        galat['mitra.akun'] = 'Pilih akun mitra yang sudah ada'
      }
    }
    if (input.rab && input.rab.berlakuSampai < hariIni) {
      galat.rab = 'Masa RAB tidak boleh berakhir sebelum hari ini'
    }
  }

  return Object.keys(galat).length === 0 ? { ok: true } : { ok: false, galat }
}

export function namaKonfirmasiCocok(ketik: string, nama: string): boolean {
  const k = ketik.trim().toLowerCase()
  return k.length > 0 && k === nama.trim().toLowerCase()
}
