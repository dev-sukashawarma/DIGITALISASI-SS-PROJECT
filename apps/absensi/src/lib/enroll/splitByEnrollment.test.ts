import { describe, it, expect } from "vitest";
import { splitByEnrollment, type EnrollStaff } from "./splitByEnrollment";

const mk = (id: string, enrolled_at: string | null): EnrollStaff =>
  ({ id, name: id, role: "crew", enrolled_at });

describe("splitByEnrollment", () => {
  it("memisah staff terdaftar vs belum berdasarkan enrolled_at", () => {
    const { unenrolled, enrolled } = splitByEnrollment([
      mk("a", null),
      mk("b", "2026-06-01T00:00:00Z"),
      mk("c", null),
    ]);
    expect(unenrolled.map((s) => s.id)).toEqual(["a", "c"]);
    expect(enrolled.map((s) => s.id)).toEqual(["b"]);
  });

  it("mengembalikan dua array kosong untuk input kosong", () => {
    const { unenrolled, enrolled } = splitByEnrollment([]);
    expect(unenrolled).toEqual([]);
    expect(enrolled).toEqual([]);
  });
});
