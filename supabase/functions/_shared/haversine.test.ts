import { assertEquals } from "jsr:@std/assert";
import { haversineMeters } from "./haversine.ts";

Deno.test("identical points → 0", () => {
  assertEquals(haversineMeters({ lat: -6.2, lng: 106.84 }, { lat: -6.2, lng: 106.84 }), 0);
});

Deno.test("1 degree latitude ≈ 111 km", () => {
  const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  if (d < 111000 || d > 111400) throw new Error(`unexpected: ${d}`);
});
