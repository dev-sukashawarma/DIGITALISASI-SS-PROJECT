// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useClockKiosk } from "./useClockKiosk";

// Mock Supabase client
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: { lat: -6.2, lng: 106.8, is_active: true } }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          or: () => ({
            not: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    }),
    channel: () => ({
      on: function() { return this; },
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

// Mock queue and recognizer
vi.mock("@/lib/attendance/useAttendanceQueue", () => ({
  useAttendanceQueue: () => ({
    enqueue: vi.fn(),
    flushQueue: vi.fn(),
  }),
}));

describe("useClockKiosk permission flow", () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalGeolocation = navigator.geolocation;
  const originalPermissions = navigator.permissions;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: originalMediaDevices, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: originalGeolocation, configurable: true });
    Object.defineProperty(navigator, "permissions", { value: originalPermissions, configurable: true });
  });

  it("should initialize in prompt state when permissions are not denied", () => {
    const { result } = renderHook(() => useClockKiosk("outlet-1"));
    expect(result.current.permissionState).toBe("prompt");
  });

  it("should grant permissions when requestPermissions is called and both camera and location succeed", async () => {
    const stopMock = vi.fn();
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: stopMock }],
    });
    const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
      success({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 10 } });
    });

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: mockGetCurrentPosition, watchPosition: vi.fn().mockReturnValue(1), clearWatch: vi.fn() },
      configurable: true,
    });

    const { result } = renderHook(() => useClockKiosk("outlet-1"));

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(mockGetUserMedia).toHaveBeenCalled();
    expect(mockGetCurrentPosition).toHaveBeenCalled();
    expect(stopMock).toHaveBeenCalled();
    expect(result.current.permissionState).toBe("granted");
    expect(result.current.permissionError).toBeNull();
  });

  it("should attempt location permission even if camera fails, and set descriptive error", async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(new Error("Camera error"));
    const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
      success({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 10 } });
    });

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: mockGetCurrentPosition, watchPosition: vi.fn().mockReturnValue(1), clearWatch: vi.fn() },
      configurable: true,
    });

    const { result } = renderHook(() => useClockKiosk("outlet-1"));

    await act(async () => {
      await result.current.requestPermissions();
    });

    // Verify geolocation request WAS called even though camera failed
    expect(mockGetCurrentPosition).toHaveBeenCalled();
    expect(result.current.permissionState).toBe("denied");
    expect(result.current.permissionError?.toLowerCase()).toContain("kamera");
  });

  it("should re-check permissions when tab gains focus", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ state: "granted" });
    Object.defineProperty(navigator, "permissions", {
      value: { query: mockQuery },
      configurable: true,
    });

    const { result } = renderHook(() => useClockKiosk("outlet-1"));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(result.current.permissionState).toBe("granted");
    });
  });
});
