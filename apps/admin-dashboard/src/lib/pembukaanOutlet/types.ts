export type JenisOutlet = 'internal' | 'mitra'

export type AkunMitraInput =
  | { mode: 'baru'; nama: string; username: string; password: string }
  | { mode: 'lama'; userId: string }

export interface MitraInput {
  nilaiInvestasi: number
  persentaseBagiHasil: number
  managementFee: number
  akun: AkunMitraInput
  namaMitra: string
}

export interface RabInput {
  berlakuSampai: string
  kategoriKecuali: string[]
}

export interface InputWizard {
  jenis: JenisOutlet
  nama: string
  alamat: string
  lat: number | null
  lng: number | null
  telepon: string
  region: string
  jamBuka: string
  jamTutup: string
  /** YYYY-MM-DD, boleh kosong saat outlet dibuat; wajib sebelum Go-Live. */
  tanggalGrandOpening: string | null
  amStaffId: string
  leaderStaffId: string | null
  mitra: MitraInput | null
  rab: RabInput | null
}

export interface LangkahPersiapan {
  kunci: string
  label: string
  penanggungJawab: string
  wajib: boolean
  selesai: boolean
  info: string | null
}

export interface StatusPersiapan {
  outletId: string
  nama: string
  jenis: JenisOutlet
  status: 'pending' | 'active' | 'inactive'
  tanggalGrandOpening: string | null
  siapGoLive: boolean
  langkah: LangkahPersiapan[]
}

export type HasilAksi<T extends object = object> =
  | ({ ok: true; peringatan?: string } & T)
  | { ok: false; pesan: string }
