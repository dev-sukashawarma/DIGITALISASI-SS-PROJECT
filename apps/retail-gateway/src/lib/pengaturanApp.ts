import { createServiceClient } from './supabase'

export type PengaturanApp = {
  menitPesanTerakhir: number
  estimasiSiap: string
  waCs: string | null
  versiMinimumAndroid: number
  urlSyarat: string | null
  urlPrivasi: string | null
}

export const PENGATURAN_BAWAAN: PengaturanApp = {
  menitPesanTerakhir: 30,
  estimasiSiap: '15–20 menit',
  waCs: null,
  versiMinimumAndroid: 1,
  urlSyarat: null,
  urlPrivasi: null,
}

const angka = (v: unknown, cadangan: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : cadangan
const teks = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function petakanPengaturan(baris: unknown): PengaturanApp {
  if (typeof baris !== 'object' || baris === null) return PENGATURAN_BAWAAN
  const r = baris as Record<string, unknown>
  return {
    menitPesanTerakhir: angka(r.menit_pesan_terakhir, PENGATURAN_BAWAAN.menitPesanTerakhir),
    estimasiSiap: teks(r.estimasi_siap) ?? PENGATURAN_BAWAAN.estimasiSiap,
    waCs: teks(r.wa_cs),
    versiMinimumAndroid: angka(r.versi_minimum_android, 1),
    urlSyarat: teks(r.url_syarat),
    urlPrivasi: teks(r.url_privasi),
  }
}

let tersimpan: { pada: number; data: PengaturanApp } | null = null
const UMUR_MS = 60 * 1000

/**
 * Tak pernah melempar. DB gagal -> nilai terakhir, atau bawaan.
 * Bawaan (30 menit) = tetap ada batas; JANGAN jatuh ke "buka 24 jam".
 */
export async function ambilPengaturan(): Promise<PengaturanApp> {
  if (tersimpan && Date.now() - tersimpan.pada < UMUR_MS) return tersimpan.data
  try {
    const { data, error } = await createServiceClient()
      .from('app_pengaturan')
      .select('menit_pesan_terakhir, estimasi_siap, wa_cs, versi_minimum_android, url_syarat, url_privasi')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    tersimpan = { pada: Date.now(), data: petakanPengaturan(data) }
    return tersimpan.data
  } catch (e) {
    console.error('gagal membaca app_pengaturan', e)
    return tersimpan?.data ?? PENGATURAN_BAWAAN
  }
}
