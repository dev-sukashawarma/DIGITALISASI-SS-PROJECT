import type { JenisOutlet, LangkahPersiapan, StatusPersiapan } from './types'

interface LangkahMentah {
  kunci: string
  label: string
  penanggung_jawab: string
  wajib: boolean
  selesai: boolean
  info: string | null
}

/** Memetakan keluaran RPC `status_persiapan_outlet` (jsonb snake_case). */
export function petakanStatusPersiapan(raw: Record<string, unknown>): StatusPersiapan {
  const langkah = ((raw.langkah ?? []) as LangkahMentah[]).map(
    (l): LangkahPersiapan => ({
      kunci: l.kunci,
      label: l.label,
      penanggungJawab: l.penanggung_jawab,
      wajib: Boolean(l.wajib),
      selesai: Boolean(l.selesai),
      info: l.info ?? null,
    }),
  )
  return {
    outletId: String(raw.outlet_id),
    nama: String(raw.nama ?? ''),
    jenis: raw.jenis as JenisOutlet,
    status: raw.status as StatusPersiapan['status'],
    tanggalGrandOpening: (raw.tanggal_grand_opening as string | null) ?? null,
    siapGoLive: Boolean(raw.siap_go_live),
    langkah,
  }
}

export function ringkasLangkahWajib(langkah: LangkahPersiapan[]): {
  selesai: number
  total: number
  tertahan: string | null
} {
  const wajib = langkah.filter(l => l.wajib)
  return {
    selesai: wajib.filter(l => l.selesai).length,
    total: wajib.length,
    tertahan: wajib.find(l => !l.selesai)?.label ?? null,
  }
}

/** `tanggal` dan `hariIni` berformat YYYY-MM-DD. */
export function hitungMundur(tanggal: string | null, hariIni: string): string {
  if (!tanggal) return 'Belum ditentukan'
  const selisih = Math.round((Date.parse(`${tanggal}T00:00:00Z`) - Date.parse(`${hariIni}T00:00:00Z`)) / 86_400_000)
  if (selisih > 0) return `H-${selisih}`
  if (selisih === 0) return 'Hari H'
  return `Lewat ${-selisih} hari`
}
