import { describe, expect, test } from "vitest";
import { haversineMeters, isWithinRadius } from "./gps";

describe("haversineMeters", () => {
  test("returns 0 for identical points", () => {
    const p = { lat: -6.2, lng: 106.84 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  test("computes ~111.19 km for 1 degree of latitude", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  test("is symmetric", () => {
    const a = { lat: -6.21, lng: 106.84 };
    const b = { lat: -6.22, lng: 106.85 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("isWithinRadius", () => {
  const outlet = { lat: -6.2, lng: 106.84 };

  test("true when point equals center", () => {
    expect(isWithinRadius(outlet, outlet, 100)).toBe(true);
  });

  test("true for a point a few meters away within radius", () => {
    // ~0.00005 deg lat ≈ 5.5 m north
    const near = { lat: outlet.lat + 0.00005, lng: outlet.lng };
    expect(isWithinRadius(outlet, near, 100)).toBe(true);
  });

  test("false for a point clearly outside radius", () => {
    // ~0.005 deg lat ≈ 555 m north
    const far = { lat: outlet.lat + 0.005, lng: outlet.lng };
    expect(isWithinRadius(outlet, far, 100)).toBe(false);
  });

  test("boundary: distance exactly at radius counts as within", () => {
    const d = haversineMeters(outlet, { lat: outlet.lat + 0.005, lng: outlet.lng });
    expect(isWithinRadius(outlet, { lat: outlet.lat + 0.005, lng: outlet.lng }, d)).toBe(true);
  });
});
