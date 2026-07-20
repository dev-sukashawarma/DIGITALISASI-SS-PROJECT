import type { AttendancePayload } from "./types";

/** Item antrian offline: payload absen + selfie dataURL (diupload saat sync). */
export type QueuedAbsen = {
  payload: AttendancePayload & { outlet_id?: string };
  selfieDataUrl: string | null;
  /** Opsional — payload sudah membawa outlet_id; ini hanya override. */
  outlet_id?: string;
};

/**
 * Susun payload yang dikirim ke server saat antrian offline di-flush.
 *
 * outlet_id diambil dari item bila ada, kalau tidak JATUH KE payload. Urutan ini
 * penting: kiosk meng-enqueue tanpa argumen outlet_id, jadi menimpa dengan
 * `item.outlet_id || ''` membuat server menolak `cross_outlet` (403) dan antrian
 * membuang absennya (4xx = drop) — absen offline hilang tanpa jejak.
 */
export function buildQueuedPayload(item: QueuedAbsen): AttendancePayload & { outlet_id: string } {
  return {
    ...item.payload,
    outlet_id: item.outlet_id || item.payload.outlet_id || "",
    selfie_base64: item.selfieDataUrl || undefined,
    from_queue: true,
  };
}
