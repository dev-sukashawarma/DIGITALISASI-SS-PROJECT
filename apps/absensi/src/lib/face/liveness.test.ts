import { describe, it, expect } from "vitest";
import { createLivenessDetector, type LivenessFeatures } from "./liveness";

const F = (ear: number, noseX = 0.5, noseY = 0.5, yawRatio = 0.5): LivenessFeatures => ({ ear, noseX, noseY, yawRatio });

// blink mengkalibrasi baseline mata-terbuka di 5 frame pertama (selalu false),
// lalu butuh ear turun <82% baseline (tertutup) kemudian naik >95% baseline (terbuka).
describe("liveness blink", () => {
  it("lolos saat mata terbuka→tertutup→terbuka", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 5; i++) expect(d.feed(F(0.3))).toBe(false); // kalibrasi baseline=0.3
    expect(d.feed(F(0.1))).toBe(false); // tertutup (0.1 < 0.246)
    expect(d.feed(F(0.3))).toBe(true);  // terbuka lagi (0.3 > 0.285) → lolos
  });
  it("tidak lolos bila mata selalu terbuka (foto diam)", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 10; i++) expect(d.feed(F(0.3))).toBe(false);
  });
});

// turn-left pakai yawRatio: menoleh → yawRatio > 0.65, lalu kembali tengah 0.40–0.60.
describe("liveness turn-left", () => {
  it("lolos saat kepala menoleh lalu kembali tengah", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(F(0.3, 0.5, 0.5, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.5, 0.5, 0.7))).toBe(false); // menoleh (yawRatio > 0.65)
    expect(d.feed(F(0.3, 0.5, 0.5, 0.5))).toBe(true);  // kembali tengah → lolos
  });
});

// nod: noseY turun > NOD_DOWN(0.55) lalu naik < NOD_UP(0.50).
describe("liveness nod", () => {
  it("lolos saat hidung turun lalu naik", () => {
    const d = createLivenessDetector("nod");
    expect(d.feed(F(0.3, 0.5, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.5, 0.6))).toBe(false); // turun (0.6 > 0.55)
    expect(d.feed(F(0.3, 0.5, 0.45))).toBe(true);  // naik (0.45 < 0.50) → lolos
  });
});

describe("idempotensi setelah lolos", () => {
  it("tetap true setelah lolos", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 5; i++) d.feed(F(0.3)); // kalibrasi
    d.feed(F(0.1)); // tertutup
    expect(d.feed(F(0.3))).toBe(true); // terbuka → lolos
    expect(d.feed(F(0.3))).toBe(true); // sticky
  });
});
