/**
 * Logika face matching 1:1 (M1, client-side per ADR-003).
 *
 * Murni numerik — tidak bergantung face-api.js. Descriptor = vektor[128]
 * (Float32Array dari face-api.js diterima sebagai number[]). Pemuatan model
 * & ekstraksi descriptor ada di wrapper terpisah (lib/face/recognizer).
 */

export type Descriptor = readonly number[];

/** Threshold similarity default (COSINE). Di atas ini dianggap cocok.
 *
 * Pindah dari metrik euclidean Human (match.similarity) ke COSINE pada descriptor
 * ter-L2-normalisasi: pengukuran lapangan menunjukkan magnitudo descriptor antar
 * orang bervariasi (L2 norm 7.4–9.9) sehingga metrik berbasis euclidean tidak andal.
 * Kalibrasi lapangan (enrollment frontal-only, metrik cosine): orang SAMA ~0.86,
 * orang BEDA ~0.53. Threshold 0.725 ≈ titik tengah → tahan banting di kedua sisi:
 * orang asli tetap lolos walau cahaya/sudut kurang ideal, orang beda ketolak telak.
 */
export const DEFAULT_MATCH_THRESHOLD = 0.725;

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

/** Cosine similarity (dot / (|a|·|b|)). Range -1..1; untuk wajah ~0..1.
 * Tahan terhadap variasi magnitudo descriptor (tak seperti euclidean). */
export function faceSimilarity(a: Descriptor, b: Descriptor): number {
  assertSameLength(a, b);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
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
