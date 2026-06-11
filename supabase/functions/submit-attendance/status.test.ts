import { assertEquals } from "jsr:@std/assert";
import { computeStatus } from "./status.ts";

const cfg = { jam_masuk: "09:00", toleransi_menit: 15 };

Deno.test("clock-out selalu 'tepat' (tak dihitung telat)", () => {
  assertEquals(computeStatus("out", "2026-06-09T10:00:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("masuk sebelum jam_masuk+toleransi → tepat", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:10:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("masuk setelah jam_masuk+toleransi → telat", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:30:00+07:00", cfg, "Asia/Jakarta"), "telat");
});

Deno.test("tepat di batas toleransi → tepat (inklusif)", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:15:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});
