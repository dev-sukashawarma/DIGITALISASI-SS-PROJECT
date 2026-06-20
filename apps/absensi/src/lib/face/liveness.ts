export type Challenge = "blink" | "turn-left" | "turn-right" | "nod";

export const CHALLENGE_LABEL: Record<Challenge, string> = {
  "blink": "Kedipkan mata",
  "turn-left": "Tolehkan kepala ke kiri",
  "turn-right": "Tolehkan kepala ke kanan",
  "nod": "Anggukkan kepala",
};

/** Pilih tantangan acak menoleh kiri/kanan. */
export function pickChallenge(rng: () => number = Math.random): Challenge {
  const all: Challenge[] = ["turn-left", "turn-right"];
  return all[Math.floor(rng() * all.length)]!;
}

/** 
 * Detektor stateful menggunakan array gesture dari @vladmandic/human
 * gesture yang dikenali Human murni dari string, misalnya:
 * 'blink', 'facing left', 'facing right', 'head up', 'head down'
 */
export function createLivenessDetector(challenge: Challenge) {
  let phase = 0; // 0 = menunggu aksi, 1 = kembali ke tengah/lolos

  // feed() menerima array of gestures dari Human (res.gesture)
  function feed(gestures: { gesture: string }[]): boolean {
    if (phase === 1) return true;
    
    // Konversi array object ke array of strings biar gampang dicek
    const gList = gestures.map(g => g.gesture);

    switch (challenge) {
      case "blink":
        if (gList.includes("blink") || gList.includes("blink left eye") || gList.includes("blink right eye")) {
          phase = 1;
        }
        break;
      case "turn-left":
        // facing left di Human artinya wajah menoleh ke kiri
        if (gList.includes("facing left")) {
          phase = 1;
        }
        break;
      case "turn-right":
        if (gList.includes("facing right")) {
          phase = 1;
        }
        break;
      case "nod":
        // kombinasi menunduk / mengangguk
        if (gList.includes("head down") || gList.includes("head up")) {
          phase = 1;
        }
        break;
    }
    return phase === 1;
  }
  return { feed };
}
