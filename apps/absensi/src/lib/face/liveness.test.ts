import { describe, it, expect } from "vitest";
import { createLivenessDetector } from "./liveness";

describe("liveness blink", () => {
  it("lolos saat mendeteksi blink", () => {
    const d = createLivenessDetector("blink");
    expect(d.feed([{ gesture: "facing center" }])).toBe(false);
    expect(d.feed([{ gesture: "blink" }])).toBe(true);
  });
});

describe("liveness turn-left", () => {
  it("lolos saat facing left", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed([{ gesture: "facing center" }])).toBe(false);
    expect(d.feed([{ gesture: "facing left" }])).toBe(true);
  });
});

describe("liveness nod", () => {
  it("lolos saat head down atau up", () => {
    const d = createLivenessDetector("nod");
    expect(d.feed([{ gesture: "facing center" }])).toBe(false);
    expect(d.feed([{ gesture: "head down" }])).toBe(true);
  });
});

describe("idempotensi setelah lolos", () => {
  it("tetap true setelah lolos", () => {
    const d = createLivenessDetector("blink");
    d.feed([{ gesture: "blink" }]);
    expect(d.feed([{ gesture: "facing center" }])).toBe(true);
  });
});
