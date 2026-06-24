import { describe, expect, test } from "vitest";
import {
  DEFAULT_MATCH_THRESHOLD,
  averageDescriptors,
  euclideanDistance,
  isMatch,
} from "./match";

describe("euclideanDistance", () => {
  test("is 0 for identical descriptors", () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  test("computes the L2 distance", () => {
    // sqrt(3^2 + 4^2) = 5
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
  });

  test("throws when descriptors differ in length", () => {
    expect(() => euclideanDistance([1, 2], [1, 2, 3])).toThrow();
  });
});

describe("isMatch", () => {
  test("matches identical descriptors", () => {
    expect(isMatch([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  test("rejects descriptors farther than the threshold", () => {
    expect(isMatch([1, 0], [0, 1], 0.5)).toBe(false);
  });

  test("accepts descriptors within the threshold", () => {
    expect(isMatch([1, 0], [0.99, 0.1], 0.8)).toBe(true);
  });

  test("treats similarity exactly at threshold as a match (inclusive)", () => {
    expect(isMatch([1, 0], [0.99, 0.14], 0.99)).toBe(true);
  });

  test("uses DEFAULT_MATCH_THRESHOLD when none provided", () => {
    expect(DEFAULT_MATCH_THRESHOLD).toBe(0.80);
    expect(isMatch([1, 0], [0, 1])).toBe(false);
  });
});

describe("averageDescriptors", () => {
  test("returns the element-wise mean of multiple descriptors", () => {
    expect(averageDescriptors([
      [0, 10],
      [2, 20],
      [4, 30],
    ])).toEqual([2, 20]);
  });

  test("returns the single descriptor unchanged", () => {
    expect(averageDescriptors([[1, 2, 3]])).toEqual([1, 2, 3]);
  });

  test("throws on an empty list", () => {
    expect(() => averageDescriptors([])).toThrow();
  });

  test("throws when descriptors differ in length", () => {
    expect(() => averageDescriptors([[1, 2], [1, 2, 3]])).toThrow();
  });
});
