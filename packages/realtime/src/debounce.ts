/**
 * Debounce per-key.
 *
 * `maxWaitMs` (opsional): batas tunggu terlama sejak event PERTAMA dalam satu
 * gelombang. Tanpa batas ini, debounce murni bisa "kelaparan" — bila event
 * datang terus dengan jeda < waitMs (mis. stok_balance dari 19 outlet saat
 * jam ramai), fungsi tak pernah dijalankan sampai ada jeda. Dengan maxWaitMs,
 * fungsi dijamin jalan paling lambat maxWaitMs setelah event pertama.
 * Bila tidak diisi, perilakunya persis seperti sebelumnya.
 */
export function createDebouncer(waitMs: number, maxWaitMs?: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const firstAt = new Map<string, number>();
  return {
    schedule(key: string, fn: () => void) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      const now = Date.now();
      if (!firstAt.has(key)) firstAt.set(key, now);
      let delay = waitMs;
      if (maxWaitMs !== undefined) {
        const deadline = firstAt.get(key)! + maxWaitMs;
        delay = Math.max(0, Math.min(waitMs, deadline - now));
      }
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          firstAt.delete(key);
          fn();
        }, delay)
      );
    },
    cancelAll() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      firstAt.clear();
    },
  };
}
