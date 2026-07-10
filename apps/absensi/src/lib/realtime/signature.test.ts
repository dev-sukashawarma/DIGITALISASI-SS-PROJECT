import { describe, it, expect } from "vitest";
import { subsSignature } from "./signature";

describe("subsSignature", () => {
  it("stabil untuk subs identik", () => {
    const a = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    expect(a).toBe(b);
  });

  it("berubah saat filter berbeda", () => {
    const a = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "attendance", filter: "outlet_id=eq.2" }]);
    expect(a).not.toBe(b);
  });

  it("default event '*' dan filter kosong", () => {
    expect(subsSignature([{ table: "x" }])).toBe("x|*|");
  });
});
