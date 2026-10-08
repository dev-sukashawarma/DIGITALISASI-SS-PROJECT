import type { AnalisisVideoData, KonteksMarcom } from './tipe'
import { batasi, cocok, kelompokkan, metaDasar } from './bantu'

export interface ParameterAnalisisVideo {
  verdict?: string
  cari?: string
  limit?: number
}

function rataRata(daftar: AnalisisVideoData[], f: (v: AnalisisVideoData) => number): number | null {
  if (!daftar.length) return null
  return Math.round((daftar.reduce((s, v) => s + f(v), 0) / daftar.length) * 10) / 10
}

export async function hitungAnalisisVideo(konteks: KonteksMarcom, params: ParameterAnalisisVideo = {}) {
  const semua = await konteks.daftarAnalisisVideo()
  const daftar = semua
    .filter((v) => !params.verdict || v.verdict.toUpperCase() === params.verdict.toUpperCase())
    .filter((v) => cocok(`${v.judul} ${v.konten_terkait || ''}`, params.cari))
    .sort((a, b) => b.dibuat.localeCompare(a.dibuat))
  return {
    ringkasan: {
      total: daftar.length,
      rata_skor_total: rataRata(daftar, (v) => v.skor_total),
      rata_skor: {
        hook: rataRata(daftar, (v) => v.skor.hook),
        food_appeal: rataRata(daftar, (v) => v.skor.food_appeal),
        audio: rataRata(daftar, (v) => v.skor.audio),
        pacing: rataRata(daftar, (v) => v.skor.pacing),
        cta: rataRata(daftar, (v) => v.skor.cta),
      },
      per_verdict: kelompokkan(daftar, (v) => v.verdict, () => 1).map(({ nama, jumlah }) => ({ nama, jumlah })),
    },
    daftar: daftar.slice(0, batasi(params.limit, 10, 50)),
    meta: metaDasar(konteks.sekarang),
  }
}
