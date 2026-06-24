/**
 * Logika face matching 1:1 (M1, client-side per ADR-003).
 *
 * Murni numerik — tidak bergantung face-api.js. Descriptor = vektor[128]
 * (Float32Array dari face-api.js diterima sebagai number[]). Pemuatan model
 * & ekstraksi descriptor ada di wrapper terpisah (lib/face/recognizer).
 */

export type Descriptor = readonly number[];

import { match } from "@vladmandic/human";

/** Threshold similarity default; di atas ini dianggap cocok.
 * Dinaikkan ke 0.45: 0.25 terlalu longgar → false-accept (wajah orang lain ikut
 * lolos). Orang sama biasanya skor ~0.55-0.85, orang beda ~0.30-0.50, jadi 0.45
 * memisahkan keduanya sambil tetap toleran ke variasi lighting/kamera.
 */
export const DEFAULT_MATCH_THRESHOLD = 0.45;

function assertSameLength(a: Descriptor, b: Descriptor): void {
  if (a.length !== b.length) {
    throw new Error(
      `Descriptor length mismatch: ${a.length} vs ${b.length}`,
    );
  }
}

/** Euclidean distance (L2 norm) antara dua descriptor */
export function euclideanDistance(a: Descriptor, b: Descriptor): number {
  assertSameLength(a, b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Menghitung kemiripan menggunakan fungsi bawaan Human (0 sampai 1) */
export function faceSimilarity(a: Descriptor, b: Descriptor): number {
  assertSameLength(a, b);
  return match.similarity(a as number[], b as number[]);
}

/** True bila kedua descriptor cocok (similarity >= threshold). */
export function isMatch(
  a: Descriptor,
  b: Descriptor,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): boolean {
  return faceSimilarity(a, b) >= threshold;
}

/**
 * Rata-rata element-wise dari beberapa descriptor (mis. 1–3 foto saat enroll).
 * Menghasilkan satu descriptor representatif.
 */
export function averageDescriptors(descriptors: Descriptor[]): number[] {
  if (descriptors.length === 0) {
    throw new Error("averageDescriptors: butuh minimal satu descriptor");
  }
  const len = descriptors[0]!.length;
  const sum = new Array<number>(len).fill(0);
  for (const d of descriptors) {
    assertSameLength(d, sum);
    for (let i = 0; i < len; i++) {
      sum[i]! += d[i]!;
    }
  }
  return sum.map((v) => v / descriptors.length);
}
