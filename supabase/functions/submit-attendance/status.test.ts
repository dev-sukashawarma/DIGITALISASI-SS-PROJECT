import { assertEquals } from "jsr:@std/assert";
import { computeStatus } from "./status.ts";

const cfg = { jam_masuk: "09:00", jam_keluar: "17:00", toleransi_menit: 15 };

Deno.test("clock-out sebelum jam_keluar → lebih_awal", () => {
  assertEquals(computeStatus("out", "2026-06-09T16:30:00+07:00", cfg, "Asia/Jakarta"), "lebih_awal");
});

Deno.test("clock-out tepat pada jam_keluar → tepat", () => {
  assertEquals(computeStatus("out", "2026-06-09T17:00:30+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("clock-out setelah jam_keluar (>= 1 menit) → pulang_telat", () => {
  assertEquals(computeStatus("out", "2026-06-09T17:05:00+07:00", cfg, "Asia/Jakarta"), "pulang_telat");
});

Deno.test("masuk sebelum jam_masuk → tepat", () => {
  assertEquals(computeStatus("in", "2026-06-09T08:55:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("masuk di antara jam_masuk dan toleransi → telat", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:10:00+07:00", cfg, "Asia/Jakarta"), "telat");
});

Deno.test("masuk setelah jam_masuk + toleransi → alpha", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:30:00+07:00", cfg, "Asia/Jakarta"), "alpha");
});

Deno.test("masuk tepat di batas toleransi → telat (inklusif)", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:15:00+07:00", cfg, "Asia/Jakarta"), "telat");
});
