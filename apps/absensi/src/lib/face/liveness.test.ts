import { describe, expect, it } from "vitest";
import { CHALLENGE_LABEL, createLivenessDetector } from "./liveness";

// Liveness lolos hanya setelah bergerak LALU kembali menghadap kamera. useClockKiosk
// memakai sudahBergerak() untuk mengganti instruksi ke "hadap kembali ke kamera";
// kalau tahap ini bergeser, user berhenti di posisi menoleh.
const g = (...names: string[]) => names.map((gesture) => ({ gesture }));

describe("createLivenessDetector", () => {
  it("frontal saja tidak lolos dan belum dianggap bergerak", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(g())).toBe(false);
    expect(d.sudahBergerak()).toBe(false);
  });

  it("menoleh sesuai tantangan belum lolos tapi instruksi siap berganti", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(g("facing left"))).toBe(false);
    expect(d.sudahBergerak()).toBe(true);
  });

  it("lolos setelah kembali menghadap kamera", () => {
    const d = createLivenessDetector("turn-right");
    expect(d.feed(g("facing right"))).toBe(false);
    expect(d.feed(g())).toBe(true);
    expect(d.feed(g("facing left"))).toBe(true); // idempoten setelah lolos
  });

  it("menoleh ke arah yang salah tidak dihitung", () => {
    const d = createLivenessDetector("turn-right");
    expect(d.feed(g("facing left"))).toBe(false);
    expect(d.sudahBergerak()).toBe(false);
  });

  it("instruksi awal sudah menyebut kembali menghadap kamera", () => {
    for (const label of Object.values(CHALLENGE_LABEL)) {
      expect(label).toContain("hadap kamera");
    }
  });
});
