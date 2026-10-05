export type Pose = 'diam' | 'berpikir' | 'rekap' | 'bingung'
export type Klip = Pose | 'sapa'

export type KeadaanPutar = { pose: Pose | null; klip: Klip; sekali: boolean }
export type Kejadian =
  | { jenis: 'pose'; pose: Pose }
  | { jenis: 'klik' }
  | { jenis: 'selesai'; klip: Klip }

export const AWAL: KeadaanPutar = { pose: null, klip: 'diam', sekali: false }

const PERINGKAT: Record<Klip, number> = { diam: 0, sapa: 1, rekap: 2, bingung: 3, berpikir: 4 }
const klipDasar = (pose: Pose | null): Klip => (pose === 'berpikir' ? 'berpikir' : 'diam')

/** Klip sekali-putar dipicu saat pose BERUBAH (widget terus mengirim 'rekap' selama rekap belum dibuka). */
export function langkah(k: KeadaanPutar, e: Kejadian): KeadaanPutar {
  switch (e.jenis) {
    case 'pose': {
      if (e.pose === k.pose) return k
      const pose = e.pose
      if (pose === 'berpikir') return { pose, klip: 'berpikir', sekali: false }
      if (pose === 'rekap' || pose === 'bingung') {
        if (k.sekali && PERINGKAT[k.klip] > PERINGKAT[pose]) return { ...k, pose }
        return { pose, klip: pose, sekali: true }
      }
      if (k.sekali) return { ...k, pose }
      return { pose, klip: 'diam', sekali: false }
    }
    case 'klik':
      if (k.sekali || k.klip === 'berpikir') return k
      return { ...k, klip: 'sapa', sekali: true }
    case 'selesai':
      if (!k.sekali || e.klip !== k.klip) return k
      return { ...k, klip: klipDasar(k.pose), sekali: false }
  }
}
