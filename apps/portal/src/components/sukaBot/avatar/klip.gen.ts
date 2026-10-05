// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.
import type { Klip } from './rencanaPutar'

export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }

/** Lebar dibagi tinggi kotak chef (sama untuk semua klip). */
export const RASIO = 0.574

export const KLIP: Record<Klip, InfoKlip> = {
  diam: { webm: '/suka-bot/diam.webm?v=dfb3bd26b8', webp: '/suka-bot/diam.anim.webp?v=481155a269', gambar: '/suka-bot/diam.webp?v=81a1638392', ulang: true, durasiMs: 6958 },
  berpikir: { webm: '/suka-bot/berpikir.webm?v=b4d3bed485', webp: '/suka-bot/berpikir.anim.webp?v=e4cf6ad5eb', gambar: '/suka-bot/berpikir.webp?v=a4d88afe57', ulang: true, durasiMs: 5542 },
  rekap: { webm: '/suka-bot/rekap.webm?v=34423ea183', webp: '/suka-bot/rekap.anim.webp?v=b6e0b908a9', gambar: '/suka-bot/rekap.webp?v=79a015c614', ulang: false, durasiMs: 5375 },
  bingung: { webm: '/suka-bot/bingung.webm?v=a5a383ddab', webp: '/suka-bot/bingung.anim.webp?v=c0d0304d3a', gambar: '/suka-bot/bingung.webp?v=e149d55345', ulang: false, durasiMs: 5542 },
  sapa: { webm: '/suka-bot/sapa.webm?v=da4be6398e', webp: '/suka-bot/sapa.anim.webp?v=291d5456df', gambar: '/suka-bot/sapa.webp?v=1a617692bd', ulang: false, durasiMs: 5583 },
}
