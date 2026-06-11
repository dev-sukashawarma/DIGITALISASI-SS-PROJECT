export type Challenge = "blink" | "turn-left" | "turn-right" | "nod";
export type LivenessFeatures = { ear: number; noseX: number; noseY: number; yawRatio: number };

export const CHALLENGE_LABEL: Record<Challenge, string> = {
  "blink": "Kedipkan mata",
  "turn-left": "Tolehkan kepala ke kiri",
  "turn-right": "Tolehkan kepala ke kanan",
  "nod": "Anggukkan kepala",
};

const EAR_CLOSED = 0.23; // Ditingkatkan dari 0.18 agar lebih sensitif
const EAR_OPEN = 0.26;
const TURN_LO = 0.4;   // hidung geser ke kiri frame
const TURN_HI = 0.6;   // hidung geser ke kanan frame
const CENTER_LO = 0.45;
const CENTER_HI = 0.55;
const NOD_DOWN = 0.55;
const NOD_UP = 0.50;

/** Pilih tantangan acak menoleh kiri/kanan (default Math.random; rng dapat di-inject untuk test). */
export function pickChallenge(rng: () => number = Math.random): Challenge {
  const all: Challenge[] = ["turn-left", "turn-right"];
  return all[Math.floor(rng() * all.length)]!;
}

/** Detektor stateful: feed fitur per-frame; return true sekali tantangan terpenuhi (sticky). */
export function createLivenessDetector(challenge: Challenge) {
  let phase = 0; // 0 = menunggu aksi, 1 = menunggu kembali, 2 = lolos
  
  // Variabel untuk dynamic blink baseline
  let baselineEar = 0;
  let frameCount = 0;

  function feed(f: LivenessFeatures): boolean {
    if (phase === 2) return true;
    switch (challenge) {
      case "blink":
        // Mengkalibrasi mata natural (terbuka) user di 5 frame pertama
        if (frameCount < 5) {
          baselineEar = Math.max(baselineEar, f.ear);
          frameCount++;
          // Fallback jika anehnya mata selalu tertutup di awal
          if (frameCount === 5 && baselineEar < 0.20) baselineEar = 0.28;
          return false;
        }

        // Kedipan terdeteksi jika mata turun 18% dari kondisi terbukanya (sangat natural/ekstrem)
        const dropThreshold = baselineEar * 0.82;
        const openThreshold = baselineEar * 0.95;

        if (phase === 0 && f.ear < dropThreshold) phase = 1;
        else if (phase === 1 && f.ear > openThreshold) phase = 2;
        break;
      case "turn-left":
        // User menoleh ke kirinya sendiri = hidung mengarah ke kanan gambar (unmirrored) = jarak ke rahang kiri(image) membesar -> yawRatio > 0.65
        if (phase === 0 && f.yawRatio > 0.65) phase = 1;
        else if (phase === 1 && f.yawRatio >= 0.40 && f.yawRatio <= 0.60) phase = 2;
        break;
      case "turn-right":
        // User menoleh ke kanannya sendiri = hidung mengarah ke kiri gambar (unmirrored) = jarak ke rahang kiri(image) mengecil -> yawRatio < 0.35
        if (phase === 0 && f.yawRatio < 0.35) phase = 1;
        else if (phase === 1 && f.yawRatio >= 0.40 && f.yawRatio <= 0.60) phase = 2;
        break;
      case "nod":
        if (phase === 0 && f.noseY > NOD_DOWN) phase = 1;
        else if (phase === 1 && f.noseY < NOD_UP) phase = 2;
        break;
    }
    return phase === 2;
  }
  return { feed };
}

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye-Aspect-Ratio dari 6 titik mata face-api (urut p1..p6). */
export function eyeAspectRatio(p: Pt[]): number {
  const [p1, p2, p3, p4, p5, p6] = p as [Pt, Pt, Pt, Pt, Pt, Pt];
  const horiz = dist(p1, p4);
  if (horiz === 0) return 0;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * horiz);
}

/**
 * Ekstrak fitur liveness dari hasil face-api WithFaceLandmarks.
 * `det` punya .landmarks (getLeftEye/getRightEye/getNose) & .detection.box.
 */
export function featuresFromLandmarks(det: {
  landmarks: { getLeftEye(): Pt[]; getRightEye(): Pt[]; getNose(): Pt[]; getJawOutline(): Pt[] };
  detection: { box: { x: number; y: number; width: number; height: number } };
}): LivenessFeatures {
  const ear = (eyeAspectRatio(det.landmarks.getLeftEye()) + eyeAspectRatio(det.landmarks.getRightEye())) / 2;
  const nose = det.landmarks.getNose();
  const tip = nose[nose.length - 1]!; // ujung hidung
  const box = det.detection.box;
  const noseX = box.width ? (tip.x - box.x) / box.width : 0.5;
  const noseY = box.height ? (tip.y - box.y) / box.height : 0.5;

  // Rasio 3D pose (kiri vs kanan) sangat akurat & tahan banting dari loncatan bounding box
  const jaw = det.landmarks.getJawOutline();
  const leftJaw = jaw[0]!;
  const rightJaw = jaw[jaw.length - 1]!;
  const distLeft = dist(leftJaw, tip);
  const distRight = dist(rightJaw, tip);
  const yawRatio = (distLeft + distRight) > 0 ? distLeft / (distLeft + distRight) : 0.5;

  return { ear, noseX, noseY, yawRatio };
}
