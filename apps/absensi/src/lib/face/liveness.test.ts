import { describe, it, expect } from "vitest";
import { createLivenessDetector, type LivenessFeatures } from "./liveness";

const F = (ear: number, noseX = 0.5, noseY = 0.5): LivenessFeatures => ({ ear, noseX, noseY });

describe("liveness blink", () => {
  it("lolos saat mata terbuka→tertutup→terbuka", () => {
    const d = createLivenessDetector("blink");
    expect(d.feed(F(0.3))).toBe(false); // open
    expect(d.feed(F(0.1))).toBe(false); // closed
    expect(d.feed(F(0.3))).toBe(true);  // open again → pass
  });
  it("tidak lolos bila mata selalu terbuka (foto diam)", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 10; i++) expect(d.feed(F(0.3))).toBe(false);
  });
});

describe("liveness turn-left", () => {
  it("lolos saat hidung geser kiri lalu kembali", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(F(0.3, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.3))).toBe(false); // turned
    expect(d.feed(F(0.3, 0.5))).toBe(true);  // centered → pass
  });
});

describe("liveness nod", () => {
  it("lolos saat hidung turun lalu naik", () => {
    const d = createLivenessDetector("nod");
    expect(d.feed(F(0.3, 0.5, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.5, 0.7))).toBe(false); // down
    expect(d.feed(F(0.3, 0.5, 0.5))).toBe(true);  // up → pass
  });
});

describe("idempotensi setelah lolos", () => {
  it("tetap true setelah lolos", () => {
    const d = createLivenessDetector("blink");
    d.feed(F(0.3)); d.feed(F(0.1));
    expect(d.feed(F(0.3))).toBe(true);
    expect(d.feed(F(0.3))).toBe(true);
  });
});
