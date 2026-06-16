import { describe, it, expect } from "vitest";
import { createLivenessDetector, type LivenessFeatures } from "./liveness";

// Helper fitur per-frame. Default = wajah frontal, mata terbuka (ear 0.3, yawRatio 0.5).
// Override hanya field yang relevan agar intent tiap test jelas.
const F = (p: Partial<LivenessFeatures> = {}): LivenessFeatures => ({
  ear: p.ear ?? 0.3,
  noseX: p.noseX ?? 0.5,
  noseY: p.noseY ?? 0.5,
  yawRatio: p.yawRatio ?? 0.5,
});

// Lewati 5 frame kalibrasi baseline blink dengan mata terbuka.
function calibrateBlink(d: ReturnType<typeof createLivenessDetector>, ear = 0.3) {
  for (let i = 0; i < 5; i++) expect(d.feed(F({ ear }))).toBe(false);
}

describe("liveness blink", () => {
  it("lolos saat (kalibrasi)→tertutup→terbuka", () => {
    const d = createLivenessDetector("blink");
    calibrateBlink(d, 0.3);                 // baseline = 0.3
    expect(d.feed(F({ ear: 0.1 }))).toBe(false); // mata menutup
    expect(d.feed(F({ ear: 0.3 }))).toBe(true);  // membuka lagi → lolos
  });
  it("tidak lolos bila mata selalu terbuka (foto diam)", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 12; i++) expect(d.feed(F({ ear: 0.3 }))).toBe(false);
  });
});

describe("liveness turn-left", () => {
  it("lolos saat menoleh (yawRatio naik) lalu kembali ke tengah", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(F({ yawRatio: 0.5 }))).toBe(false);
    expect(d.feed(F({ yawRatio: 0.7 }))).toBe(false); // menoleh kiri
    expect(d.feed(F({ yawRatio: 0.5 }))).toBe(true);  // kembali tengah → lolos
  });
  it("tidak lolos bila wajah diam menghadap depan (foto)", () => {
    const d = createLivenessDetector("turn-left");
    for (let i = 0; i < 8; i++) expect(d.feed(F({ yawRatio: 0.5 }))).toBe(false);
  });
});

describe("liveness turn-right", () => {
  it("lolos saat menoleh (yawRatio turun) lalu kembali ke tengah", () => {
    const d = createLivenessDetector("turn-right");
    expect(d.feed(F({ yawRatio: 0.5 }))).toBe(false);
    expect(d.feed(F({ yawRatio: 0.3 }))).toBe(false); // menoleh kanan
    expect(d.feed(F({ yawRatio: 0.5 }))).toBe(true);  // kembali tengah → lolos
  });
});

describe("liveness nod", () => {
  it("lolos saat hidung turun lalu naik", () => {
    const d = createLivenessDetector("nod");
    expect(d.feed(F({ noseY: 0.5 }))).toBe(false);
    expect(d.feed(F({ noseY: 0.7 }))).toBe(false); // menunduk
    expect(d.feed(F({ noseY: 0.45 }))).toBe(true); // mengangkat → lolos
  });
});

describe("idempotensi setelah lolos", () => {
  it("tetap true setelah lolos", () => {
    const d = createLivenessDetector("blink");
    calibrateBlink(d, 0.3);
    d.feed(F({ ear: 0.1 }));
    expect(d.feed(F({ ear: 0.3 }))).toBe(true);
    expect(d.feed(F({ ear: 0.3 }))).toBe(true);
  });
});
