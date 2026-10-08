// DIBUAT OTOMATIS oleh scripts/nayra-bot/olah_klip.py. Jangan diedit tangan.

export type KlipNayra = 'diam' | 'berpikir' | 'sapa' | 'bingung'

export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }

/** Rasio lebar dibagi tinggi Nayra (sama untuk semua klip). */
export const RASIO_NAYRA = 0.5967

export const KLIP_NAYRA: Record<KlipNayra, InfoKlip> = {
  diam: { webm: '/nayra/diam.webm?v=e6a6971252', webp: '/nayra/diam.anim.webp?v=b1d6554d52', gambar: '/nayra/diam.webp?v=10f6c31aad', ulang: true, durasiMs: 7917 },
  berpikir: { webm: '/nayra/berpikir.webm?v=a3659e5d7b', webp: '/nayra/berpikir.anim.webp?v=66e1dbf12a', gambar: '/nayra/berpikir.webp?v=278ec0c85a', ulang: true, durasiMs: 7833 },
  sapa: { webm: '/nayra/sapa.webm?v=0276569d7a', webp: '/nayra/sapa.anim.webp?v=10cbcf30c8', gambar: '/nayra/sapa.webp?v=578f99cb5b', ulang: false, durasiMs: 7917 },
  bingung: { webm: '/nayra/bingung.webm?v=c1af042665', webp: '/nayra/bingung.anim.webp?v=f794770754', gambar: '/nayra/bingung.webp?v=e428560ed1', ulang: false, durasiMs: 7917 },
}
