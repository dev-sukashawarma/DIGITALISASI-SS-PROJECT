import type { LangkahPenutupan, StatusPenutupan } from './types'

interface LangkahMentah {
  kunci: string
  label: string
  penanggung_jawab: string
  wajib: boolean
  selesai: boolean
  info: string | null
  manual: boolean
  dicentang_oleh: string | null
  dicentang_at: string | null
}

/** Memetakan keluaran RPC `status_penutupan_outlet` (jsonb snake_case). */
export function petakanStatusPenutupan(raw: Record<string, unknown>): StatusPenutupan {
  const langkah = ((raw.langkah ?? []) as LangkahMentah[]).map(
    (l): LangkahPenutupan => ({
      kunci: l.kunci,
      label: l.label,
      penanggungJawab: l.penanggung_jawab,
      wajib: Boolean(l.wajib),
      selesai: Boolean(l.selesai),
      info: l.info ?? null,
      manual: Boolean(l.manual),
      dicentangOleh: l.dicentang_oleh ?? null,
      dicentangAt: l.dicentang_at ?? null,
    }),
  )
  return {
    outletId: String(raw.outlet_id),
    nama: String(raw.nama ?? ''),
    jenis: raw.jenis as StatusPenutupan['jenis'],
    status: raw.status as StatusPenutupan['status'],
    nonaktifAt: (raw.nonaktif_at as string | null) ?? null,
    alasanTutup: (raw.alasan_tutup as string | null) ?? null,
    penutupanSelesaiAt: (raw.penutupan_selesai_at as string | null) ?? null,
    siapSelesai: Boolean(raw.siap_selesai),
    langkah,
  }
}

/** Ringkasan langkah WAJIB saja; peringatan tidak pernah menahan. */
export function ringkasPenutupan(langkah: LangkahPenutupan[]): {
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
