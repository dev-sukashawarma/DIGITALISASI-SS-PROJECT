// Pengecualian data per app (spec 2026-10-08-bot-ceo-semua-app §3). Dipakai test gerbang
// registry — setiap alat dipanggil dengan argumen contohnya lalu keluarannya disisir di sini.
// Pagar rem, bukan pengganti review: alat baru tetap di-review terhadap §3.
import type { Domain } from './domain'

const UMUM: RegExp[] = [
  /\bnik\b|ktp/i,
  /face_descriptor|selfie|ref_photo_url|foto_wajah/i,
  /password|token|api_key|service_role/i,
  /(\+62|\b08)\d{8,12}\b/,
  /\b\d{16}\b/,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
  /\breason\b|alasan/i,
  /rekening|no_rek|bank_account/i,
]
// Keputusan owner 2026-10-07: gaji & kasbon per orang BOLEH, tetapi hanya lewat alat domain 'hr_rinci'.
const GAJI = /gaji|salary|payroll/i
const KASBON = /kasbon|cash_advance/i
const PELANGGAN = /nama_pelanggan|customer_name|customer_phone|no_hp_pelanggan|alamat|address/i
const BUKTI_TRANSFER = /bukti_transfer|bukti_bayar|proof_url/i
// Finance 1 (F6): keterangan bebas pengeluaran & nota/bukti tidak keluar dari bot; cukup kategori.
const KETERANGAN_BUKTI = /description|keterangan|receipt|proof_url|stealth_photo/i

const PER_APP: Partial<Record<Domain, RegExp[]>> = {
  penjualan: [PELANGGAN],
  app_retail: [PELANGGAN],
  finance: [BUKTI_TRANSFER, KETERANGAN_BUKTI],
}

export function polaTerlarang(namaAlat: string, domain: Domain): RegExp[] {
  const pola = [...UMUM, ...(PER_APP[domain] ?? [])]
  if (domain === 'hr_rinci') return pola // gaji & kasbon per orang memang isi app ini (khusus Bot HRD)
  pola.push(GAJI)
  if (namaAlat !== 'kasbon_ringkasan') pola.push(KASBON) // kasbon_ringkasan = agregat per outlet
  return pola
}

export function cariPelanggaran(teks: string, namaAlat: string, domain: Domain): RegExp | null {
  return polaTerlarang(namaAlat, domain).find((p) => p.test(teks)) ?? null
}
