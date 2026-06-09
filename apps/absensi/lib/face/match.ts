/**
 * Logika face matching 1:1 (M1, client-side per ADR-003).
 *
 * Murni numerik — tidak bergantung face-api.js. Descriptor = vektor[128]
 * (Float32Array dari face-api.js diterima sebagai number[]). Pemuatan model
 * & ekstraksi descriptor ada di wrapper terpisah (lib/face/recognizer).
 */

export type Descriptor = readonly number[];

/** Threshold euclidean default; di bawah ini dianggap cocok (ADR-003, kalibratable). */
export const DEFAULT_MATCH_THRESHOLD = 0.5;

function assertSameLength(a: Descriptor, b: Descriptor): void {
  if (a.length !== b.length) {
    throw new Error(
      `Descriptor length mismatch: ${a.length} vs ${b.length}`,
    );
  }
}

/** Jarak euclidean (L2) antara dua descriptor. */
export function euclideanDistance(a: Descriptor, b: Descriptor): number {
  assertSameLength(a, b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** True bila kedua descriptor cocok (jarak <= threshold, inklusif). */
export function isMatch(
  a: Descriptor,
  b: Descriptor,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): boolean {
  return euclideanDistance(a, b) <= threshold;
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
