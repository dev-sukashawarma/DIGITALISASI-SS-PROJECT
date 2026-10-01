import { describe, expect, it } from "vitest";
import { hitungGeserTengah } from "./pusatkan";

// Area terlihat iPhone SE di Safari: di bawah header (54px), di atas bottom nav (486px).
const VIEW = { top: 54, bottom: 486 };

describe("hitungGeserTengah", () => {
  it("menggulir ke bawah saat kotak kamera berada di bawah tengah layar", () => {
    // Kotak 340px mulai y=330 (sebagian tertutup nav) → tengahnya 500, tengah view 270.
    expect(hitungGeserTengah({ top: 330, bottom: 670 }, VIEW)).toBe(230);
  });

  it("menggulir ke atas saat kotak kamera terlalu ke atas", () => {
    expect(hitungGeserTengah({ top: -100, bottom: 240 }, VIEW)).toBe(-200);
  });

  it("tidak bergeser bila selisih masih dalam toleransi", () => {
    // Tengah kotak 280 vs tengah view 270 → 10px, di bawah 24px.
    expect(hitungGeserTengah({ top: 110, bottom: 450 }, VIEW)).toBe(0);
  });

  it("meratakan ke atas bila kotak lebih tinggi dari area terlihat", () => {
    // Kotak 500px > view 432px: bagian atas (wajah) jangan sampai terpotong.
    expect(hitungGeserTengah({ top: 200, bottom: 700 }, VIEW)).toBe(138);
  });

  it("tidak bergeser bila area terlihat kosong", () => {
    expect(hitungGeserTengah({ top: 0, bottom: 100 }, { top: 300, bottom: 300 })).toBe(0);
  });
});
