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
  // Dua fase:
  //   fase 0 = menunggu GERAKAN tantangan (mis. menoleh kiri)
  //   fase 1 = gerakan sudah dilakukan; menunggu wajah KEMBALI FRONTAL
  // Lolos HANYA saat sudah kembali frontal. Penting: verifikasi identitas di
  // pemanggil dilakukan tepat ketika feed() true — jadi harus di frame frontal,
  // bukan saat wajah menoleh (descriptor menoleh skornya rendah terhadap
  // enrollment frontal-only → salah-tolak "wajah harus orang yang sama").
  let phase = 0;
  let passed = false;

  function feed(gestures: { gesture: string }[]): boolean {
    if (passed) return true;

    const gList = gestures.map(g => g.gesture);
    const facingLeft = gList.includes("facing left");
    const facingRight = gList.includes("facing right");
    const isFrontal = !facingLeft && !facingRight; // wajah terdeteksi & tidak menoleh

    if (phase === 0) {
      let acted = false;
      switch (challenge) {
        case "blink":
          acted = gList.includes("blink") || gList.includes("blink left eye") || gList.includes("blink right eye");
          break;
        case "turn-left":
          acted = facingLeft;
          break;
        case "turn-right":
          acted = facingRight;
          break;
        case "nod":
          acted = gList.includes("head down") || gList.includes("head up");
          break;
      }
      if (!acted) return false;
      phase = 1; // gerakan terdeteksi → tunggu kembali frontal
    }

    // fase 1: lolos saat wajah sudah frontal lagi (descriptor andal utk verifikasi)
    if (isFrontal) passed = true;
    return passed;
  }
  return { feed };
}
