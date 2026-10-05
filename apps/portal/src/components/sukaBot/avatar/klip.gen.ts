// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.
import type { Klip } from './rencanaPutar'

export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }

/** Lebar dibagi tinggi kotak chef (sama untuk semua klip). */
export const RASIO = 0.574

export const KLIP: Record<Klip, InfoKlip> = {
  diam: { webm: '/suka-bot/diam.webm?v=08f6b53e67', webp: '/suka-bot/diam.anim.webp?v=08a6f30924', gambar: '/suka-bot/diam.webp?v=0d3e965400', ulang: true, durasiMs: 7000 },
  berpikir: { webm: '/suka-bot/berpikir.webm?v=d81ff5ec61', webp: '/suka-bot/berpikir.anim.webp?v=686d0af391', gambar: '/suka-bot/berpikir.webp?v=ed23a245ba', ulang: true, durasiMs: 5542 },
  rekap: { webm: '/suka-bot/rekap.webm?v=eb8151be48', webp: '/suka-bot/rekap.anim.webp?v=8e518301ae', gambar: '/suka-bot/rekap.webp?v=4b0695eeae', ulang: false, durasiMs: 5375 },
  bingung: { webm: '/suka-bot/bingung.webm?v=1cf443ae9e', webp: '/suka-bot/bingung.anim.webp?v=4a2bd04999', gambar: '/suka-bot/bingung.webp?v=540cf36c5e', ulang: false, durasiMs: 5625 },
  sapa: { webm: '/suka-bot/sapa.webm?v=ebc0280a78', webp: '/suka-bot/sapa.anim.webp?v=acec03c061', gambar: '/suka-bot/sapa.webp?v=e3f60d614d', ulang: false, durasiMs: 5625 },
}
