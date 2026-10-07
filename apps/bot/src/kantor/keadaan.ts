// Aturan keadaan meja Kantor Bot (spec §5.2). Murni — dipanggil di server dengan jam server.
import type { Profil } from '@/lib/peran'

export type Keadaan = 'bekerja' | 'siaga' | 'galat' | 'tidur'

export type BarisStatus = {
  id: string
  nama: string
  scope: string[]
  dibuat_at: string
  terakhir_at: string | null
  status_terakhir: string | null
  alat_terakhir: string | null
  panggilan_hari_ini: number
}

export type Meja = {
  id: string
  nama: string
  scope: string[]
  keadaan: Keadaan
  alatTerakhir: string | null
  terakhirAt: string | null
}

// Meja yang dikirim ke klien: + profil Hermes & izin chat pemanggil (spec §10, dihitung di server).
export type MejaKantor = Meja & { profil: Profil | null; bolehChat: boolean }

export const JENDELA_BEKERJA_DTK = 60
export const JENDELA_GALAT_MNT = 10
export const JAM_BANGUN = 7
export const JAM_TIDUR = 23
const WIB_JAM = 7 // Asia/Jakarta = UTC+7, tanpa DST

function jamWib(d: Date): number {
  return (d.getUTCHours() + WIB_JAM) % 24
}

export function tentukanKeadaan(b: BarisStatus, sekarang: Date): Keadaan {
  const umurDtk = b.terakhir_at ? (sekarang.getTime() - new Date(b.terakhir_at).getTime()) / 1000 : Infinity
  if ((b.status_terakhir === 'galat' || b.status_terakhir === 'ditolak') && umurDtk <= JENDELA_GALAT_MNT * 60) return 'galat'
  if (b.status_terakhir === 'ok' && umurDtk <= JENDELA_BEKERJA_DTK) return 'bekerja'
  const jam = jamWib(sekarang)
  if (jam < JAM_BANGUN || jam >= JAM_TIDUR) return 'tidur'
  if (b.panggilan_hari_ini > 0) return 'siaga'
  return 'tidur'
}

export function keMeja(b: BarisStatus, sekarang: Date): Meja {
  return {
    id: b.id,
    nama: b.nama,
    scope: b.scope,
    keadaan: tentukanKeadaan(b, sekarang),
    alatTerakhir: b.alat_terakhir,
    terakhirAt: b.terakhir_at,
  }
}
