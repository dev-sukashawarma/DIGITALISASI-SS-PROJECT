import { describe, expect, test, vi } from "vitest";
import { submitOrQueue } from "./submitOrQueue";

const okRes = { ok: true as const, status: "tepat" as const, ts_server: "x", attendance_id: "a", httpStatus: 200 };

describe("submitOrQueue", () => {
  test("offline → langsung antre, server tak dihubungi", async () => {
    const submit = vi.fn();
    const enqueue = vi.fn();
    const out = await submitOrQueue({ isOnline: false, submit, enqueue });

    expect(submit).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ ok: true, queued: true });
  });

  test("online & server menjawab ok → tidak diantre", async () => {
    const enqueue = vi.fn();
    const out = await submitOrQueue({ isOnline: true, submit: async () => okRes, enqueue });

    expect(enqueue).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: true, queued: false });
  });

  test("online & server MENOLAK (jawaban bisnis) → jangan diantre, teruskan alasannya", async () => {
    // Penolakan bisnis itu final. Mengantrekannya berarti mencoba lagi selamanya
    // untuk sesuatu yang tak akan pernah diterima.
    const enqueue = vi.fn();
    const out = await submitOrQueue({
      isOnline: true,
      submit: async () => ({ ok: false as const, reason: "too_early_in", httpStatus: 200 }),
      enqueue,
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: false, queued: false, reason: "too_early_in" });
  });

  // Regresi: navigator.onLine bisa `true` padahal jaringan mati (sinyal 1 bar,
  // wifi outlet tanpa internet, server restart). Dulu exception-nya lolos keluar
  // dari doSubmit: absen tak tersimpan, tak diantre, dan kiosk beku di fase
  // "submitting" karena scheduleReset tak pernah jalan.
  test("online tapi transport gagal → diantre, bukan dilempar", async () => {
    const enqueue = vi.fn();
    const out = await submitOrQueue({
      isOnline: true,
      submit: async () => { throw new TypeError("Failed to fetch"); },
      enqueue,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ ok: true, queued: true });
  });

  test("jawaban server bukan JSON (mis. redirect ke portal) → diperlakukan transport gagal", async () => {
    const enqueue = vi.fn();
    const out = await submitOrQueue({
      isOnline: true,
      submit: async () => { throw new SyntaxError("Unexpected token < in JSON"); },
      enqueue,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(out.queued).toBe(true);
  });
});
