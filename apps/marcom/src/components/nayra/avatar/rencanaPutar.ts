export type PoseNayra = 'diam' | 'berpikir' | 'sapa' | 'bingung'
export type KlipNayra = PoseNayra

export type KeadaanPutar = { pose: PoseNayra | null; klip: KlipNayra; sekali: boolean }
export type Kejadian =
  | { jenis: 'pose'; pose: PoseNayra }
  | { jenis: 'klik' }
  | { jenis: 'selesai'; klip: KlipNayra }

export const AWAL: KeadaanPutar = { pose: null, klip: 'diam', sekali: false }

const PERINGKAT: Record<KlipNayra, number> = { diam: 0, sapa: 1, bingung: 2, berpikir: 3 }
const klipDasar = (pose: PoseNayra | null): KlipNayra => (pose === 'berpikir' ? 'berpikir' : 'diam')

/** Klip sekali-putar (sapa, bingung) dipicu saat pose berubah atau diklik */
export function langkah(k: KeadaanPutar, e: Kejadian): KeadaanPutar {
  switch (e.jenis) {
    case 'pose': {
      if (e.pose === k.pose) return k
      const pose = e.pose
      if (pose === 'berpikir') return { pose, klip: 'berpikir', sekali: false }
      if (pose === 'bingung' || pose === 'sapa') {
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
