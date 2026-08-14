export function createDebouncer(waitMs: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    schedule(key: string, fn: () => void) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          fn();
        }, waitMs)
      );
    },
    cancelAll() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  };
}
