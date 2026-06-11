import { describe, it, expect } from "vitest";
import { identifyStaff } from "./identify";

const A = [0, 0, 0];
const B = [1, 1, 1];

describe("identifyStaff", () => {
  it("mengembalikan kandidat terdekat di bawah threshold", () => {
    const r = identifyStaff([0.1, 0, 0], [
      { id: "a", name: "A", descriptor: A },
      { id: "b", name: "B", descriptor: B },
    ], 0.5);
    expect(r?.id).toBe("a");
    expect(r?.distance).toBeCloseTo(0.1, 5);
  });

  it("null bila semua kandidat di atas threshold", () => {
    const r = identifyStaff([5, 5, 5], [{ id: "a", name: "A", descriptor: A }], 0.5);
    expect(r).toBeNull();
  });

  it("null bila tidak ada kandidat", () => {
    expect(identifyStaff([0, 0, 0], [], 0.5)).toBeNull();
  });
});
