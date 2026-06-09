import { describe, expect, test } from "vitest";
import { estimateDataUrlBytes, isWithinSizeLimit } from "./image";

describe("estimateDataUrlBytes", () => {
  test("menghitung byte dari panjang base64", () => {
    // "data:image/jpeg;base64,AAAA" → 4 base64 chars = 3 bytes
    expect(estimateDataUrlBytes("data:image/jpeg;base64,AAAA")).toBe(3);
  });
});

describe("isWithinSizeLimit", () => {
  test("true bila di bawah limit", () => {
    expect(isWithinSizeLimit("data:image/jpeg;base64,AAAA", 1000)).toBe(true);
  });
  test("false bila melebihi limit", () => {
    const big = "data:image/jpeg;base64," + "A".repeat(2000);
    expect(isWithinSizeLimit(big, 1000)).toBe(false);
  });
});
