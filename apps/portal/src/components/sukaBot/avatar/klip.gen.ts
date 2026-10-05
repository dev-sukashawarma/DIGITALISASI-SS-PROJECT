// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.
import type { Klip } from './rencanaPutar'

export type InfoKlip = { video: string; gambar: string; ulang: boolean; durasiMs: number }

export const KLIP: Record<Klip, InfoKlip> = {
  diam: { video: '/suka-bot/diam.mp4?v=febbc91102', gambar: '/suka-bot/diam.webp?v=2423a06da6', ulang: true, durasiMs: 7042 },
  berpikir: { video: '/suka-bot/berpikir.mp4?v=cdf5891f4d', gambar: '/suka-bot/berpikir.webp?v=94c2e18816', ulang: true, durasiMs: 5542 },
  rekap: { video: '/suka-bot/rekap.mp4?v=743cca438b', gambar: '/suka-bot/rekap.webp?v=c32ff3d95f', ulang: false, durasiMs: 5375 },
  bingung: { video: '/suka-bot/bingung.mp4?v=3eda8b9bd9', gambar: '/suka-bot/bingung.webp?v=ee33158b24', ulang: false, durasiMs: 5667 },
  sapa: { video: '/suka-bot/sapa.mp4?v=f44f94f636', gambar: '/suka-bot/sapa.webp?v=7f06a15dda', ulang: false, durasiMs: 5625 },
}
