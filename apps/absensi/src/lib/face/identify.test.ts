import { describe, it, expect } from "vitest";
import { identifyStaff } from "./identify";

const A = [1, 0, 0];
const B = [0, 1, 0];

describe("identifyStaff", () => {
  it("mengembalikan kandidat terdekat bila similarity >= threshold", () => {
    const r = identifyStaff([1, 0, 0], [
      { id: "a", name: "A", descriptor: A },
      { id: "b", name: "B", descriptor: B },
    ], 0.5);
    expect(r.id).toBe("a");
    expect(r.similarity).toBeCloseTo(1, 2);
  });

  it("mengembalikan unknown sentinel bila semua kandidat di bawah threshold", () => {
    const r = identifyStaff([0, 0, 1], [{ id: "a", name: "A", descriptor: A }], 0.5);
    expect(r.id).toBe("unknown");
    expect(r.bestSimilarity).toBeGreaterThanOrEqual(0);
  });

  it("mengembalikan unknown sentinel bila tidak ada kandidat", () => {
    const r = identifyStaff([1, 0, 0], [], 0.5);
    expect(r.id).toBe("unknown");
    expect(r.bestSimilarity).toBe(-1);
  });
});
