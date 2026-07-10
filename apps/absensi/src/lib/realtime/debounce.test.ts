import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncer } from "./debounce";

describe("createDebouncer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hanya menjalankan panggilan terakhir per key setelah wait", () => {
    const d = createDebouncer(200);
    const fn = vi.fn();
    d.schedule("a", fn);
    d.schedule("a", fn);
    d.schedule("a", fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("key berbeda dijalankan independen", () => {
    const d = createDebouncer(100);
    const a = vi.fn();
    const b = vi.fn();
    d.schedule("a", a);
    d.schedule("b", b);
    vi.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("cancelAll mencegah eksekusi tertunda", () => {
    const d = createDebouncer(100);
    const fn = vi.fn();
    d.schedule("a", fn);
    d.cancelAll();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});
