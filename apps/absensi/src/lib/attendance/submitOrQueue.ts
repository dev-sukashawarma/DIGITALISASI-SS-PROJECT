import type { SubmitResult } from "./types";

export type SubmitOrQueueOutcome = {
  /** True bila absen tersimpan di server ATAU aman tersimpan di antrian. */
  ok: boolean;
  /** True bila absen masuk antrian offline (belum sampai server). */
  queued: boolean;
  /** Alasan penolakan dari server, hanya saat `ok` false. */
  reason?: string;
};

/**
 * Kirim absen, dengan antrian offline sebagai jaring pengaman.
 *
 * Membedakan dua kegagalan yang gampang tertukar:
 *
 * - **Transport gagal** (fetch melempar, atau jawabannya bukan JSON karena
 *   middleware me-redirect ke portal) → server belum tentu menerima apa pun,
 *   jadi absen DIANTREKAN untuk dikirim ulang.
 * - **Penolakan bisnis** (server menjawab `ok:false`, mis. `too_early_in`) →
 *   ini jawaban final. Mengantrekannya hanya menunda kabar buruk dan
 *   membuat antrian mencoba selamanya.
 *
 * `navigator.onLine === true` BUKAN jaminan jaringan hidup — sinyal 1 bar atau
 * wifi outlet tanpa internet tetap melaporkan online. Karena itu cabang
 * try/catch di bawah wajib ada, bukan sekadar pelengkap cabang `!isOnline`.
 */
export async function submitOrQueue(deps: {
  isOnline: boolean;
  submit: () => Promise<SubmitResult & { httpStatus: number }>;
  enqueue: () => void;
}): Promise<SubmitOrQueueOutcome> {
  if (!deps.isOnline) {
    deps.enqueue();
    return { ok: true, queued: true };
  }

  let res: SubmitResult & { httpStatus: number };
  try {
    res = await deps.submit();
  } catch {
    deps.enqueue();
    return { ok: true, queued: true };
  }

  if (res.ok) return { ok: true, queued: false };
  return { ok: false, queued: false, reason: res.reason };
}
