export type Challenge = "blink" | "turn-left" | "turn-right" | "nod";
export type LivenessFeatures = { ear: number; noseX: number; noseY: number };

export const CHALLENGE_LABEL: Record<Challenge, string> = {
  "blink": "Kedipkan mata",
  "turn-left": "Tolehkan kepala ke kiri",
  "turn-right": "Tolehkan kepala ke kanan",
  "nod": "Anggukkan kepala",
};

const EAR_CLOSED = 0.18;
const EAR_OPEN = 0.26;
const TURN_LO = 0.4;   // hidung geser ke kiri frame
const TURN_HI = 0.6;   // hidung geser ke kanan frame
const CENTER_LO = 0.45;
const CENTER_HI = 0.55;
const NOD_DOWN = 0.6;
const NOD_UP = 0.55;

/** Pilih tantangan acak (default Math.random; rng dapat di-inject untuk test). */
export function pickChallenge(rng: () => number = Math.random): Challenge {
  const all: Challenge[] = ["blink", "turn-left", "turn-right", "nod"];
  return all[Math.floor(rng() * all.length)]!;
}

/** Detektor stateful: feed fitur per-frame; return true sekali tantangan terpenuhi (sticky). */
export function createLivenessDetector(challenge: Challenge) {
  let phase = 0; // 0 = menunggu aksi, 1 = menunggu kembali, 2 = lolos
  function feed(f: LivenessFeatures): boolean {
    if (phase === 2) return true;
    switch (challenge) {
      case "blink":
        if (phase === 0 && f.ear < EAR_CLOSED) phase = 1;
        else if (phase === 1 && f.ear > EAR_OPEN) phase = 2;
        break;
      case "turn-left":
        if (phase === 0 && f.noseX < TURN_LO) phase = 1;
        else if (phase === 1 && f.noseX >= CENTER_LO && f.noseX <= CENTER_HI) phase = 2;
        break;
      case "turn-right":
        if (phase === 0 && f.noseX > TURN_HI) phase = 1;
        else if (phase === 1 && f.noseX >= CENTER_LO && f.noseX <= CENTER_HI) phase = 2;
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
  landmarks: { getLeftEye(): Pt[]; getRightEye(): Pt[]; getNose(): Pt[] };
  detection: { box: { x: number; y: number; width: number; height: number } };
}): LivenessFeatures {
  const ear = (eyeAspectRatio(det.landmarks.getLeftEye()) + eyeAspectRatio(det.landmarks.getRightEye())) / 2;
  const nose = det.landmarks.getNose();
  const tip = nose[nose.length - 1]!; // ujung hidung
  const box = det.detection.box;
  const noseX = box.width ? (tip.x - box.x) / box.width : 0.5;
  const noseY = box.height ? (tip.y - box.y) / box.height : 0.5;
  return { ear, noseX, noseY };
}
