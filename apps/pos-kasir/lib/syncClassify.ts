/**
 * Klasifikasi kegagalan pengiriman ulang order offline.
 *
 * Sebelumnya semua respons non-5xx langsung ditandai error permanen, jadi
 * sesi yang kedaluwarsa (401) pun mematikan antrean selamanya. Sekarang
 * dibedakan: yang bisa pulih dicoba lagi dengan backoff, yang tidak akan
 * berubah diserahkan ke kasir lewat daftar "Perlu Perhatian".
 */
export type SyncOutcome = 'retry' | 'give_up';

const RETRYABLE_STATUSES = new Set([401, 408, 425, 429]);

export function classifySyncFailure(status: number): SyncOutcome {
  if (status >= 500) return 'retry';
  if (RETRYABLE_STATUSES.has(status)) return 'retry';
  return 'give_up';
}

const BASE_DELAY_MS = 15_000;
const MAX_DELAY_MS = 15 * 60 * 1000;

export function backoffDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.floor(attempts));
  const delay = BASE_DELAY_MS * Math.pow(2, safeAttempts);
  return Math.min(delay, MAX_DELAY_MS);
}
