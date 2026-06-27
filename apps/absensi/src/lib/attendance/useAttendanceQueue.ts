"use client";

import { useEffect } from "react";
import { useOfflineQueue } from "@suka/offline-queue";
import type { FlushOutcome } from "@suka/offline-queue";
import { createClient } from "@/lib/supabase";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

// Item antrian: payload + selfie dataURL (diupload saat sync).
type QueuedAbsen = { payload: AttendancePayload; selfieDataUrl: string | null; outlet_id?: string; };

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;

export function useAttendanceQueue() {
  // NOTE: useOfflineQueue returns { queue, add, flush, isPending, isOnline }.
  // The queued-items array is exposed as `queue` (not `items`).
  const { queue, add, flush, isOnline } = useOfflineQueue<QueuedAbsen>("ss-absensi-queue");
  const supabase = createClient();

  async function syncOne(item: QueuedAbsen, token: string) {
    return submitAttendance(
      { ...item.payload, selfie_base64: item.selfieDataUrl || undefined, from_queue: true, outlet_id: item.outlet_id || '' },
      { functionUrl: FUNCTION_URL, anonKey: token },
    );
  }

  /** Tambah absen ke antrian (dipakai saat offline). */
  function enqueue(payload: AttendancePayload, selfieDataUrl: string | null, outlet_id?: string) {
    return add({ payload, selfieDataUrl, outlet_id });
  }

  /** Flush semua antrian saat online. */
  async function flushQueue(_outletId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await flush(async (item: QueuedAbsen): Promise<FlushOutcome> => {
      // syncOne throws only on a transport/network failure → flush treats that
      // as 'retry'. If the server *responds*, it has a final answer for this item:
      //  - ok            → 'done'  (accepted)
      //  - 5xx           → 'retry' (transient server error, try again later)
      //  - otherwise     → 'drop'  (terminal: late/alpha or a 4xx — retrying the
      //                             same idempotent payload can never succeed and
      //                             would otherwise wedge the whole queue)
      const res = await syncOne(item, token);
      if (res.ok) return "done";
      if (res.httpStatus >= 500) return "retry";
      return "drop";
    });
  }

  // Auto-flush saat koneksi kembali — menutup regresi pasca-PWA: sebelumnya antrian
  // hanya di-flush saat mount (mengandalkan SW Background Sync untuk reconnect, kini
  // dihapus). Pola ini menyamai useOpname di apps/stok.
  useEffect(() => {
    if (isOnline) flushQueue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { enqueue, flush: flushQueue, isOnline, pending: queue.length };
}
