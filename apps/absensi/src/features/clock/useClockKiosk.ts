"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getHuman } from "@/lib/face/recognizer";
import { createClient } from "@/lib/supabase";
import { captureFrame } from "@/components/CameraCapture";
import { identifyStaff, type Candidate } from "@/lib/face/identify";
import {
  createLivenessDetector, pickChallenge,
  CHALLENGE_LABEL, type Challenge,
} from "@/lib/face/liveness";
import { submitAttendance } from "@/lib/attendance/submit";
import { useAttendanceQueue } from "@/lib/attendance/useAttendanceQueue";
import type { AttendancePayload } from "@/lib/attendance/types";
import { postToNative } from "@suka/design-system";
import { haversineMeters, GEOFENCE_RADIUS_M, MAX_GPS_ACCURACY_M, isGpsAccuracyAcceptable, formatDistanceMeters } from "@/lib/gps";

export type KioskPhase = "locating" | "location_invalid" | "locked" | "idle" | "identified" | "liveness" | "submitting" | "result";
export type KioskResult = { ok: boolean; message: string };

type StaffRow = { id: string; name: string; face_descriptor: number[] | null; allow_manual_button: boolean };

const FUNCTION_URL = "/api/submit-attendance";

/**
 * @param outletId outlet aktif
 * @param options.lockToStaffId Bila diisi, kiosk bekerja MODE 1:1 — hanya cocok
 *   dengan descriptor staff ini (akun yang sedang login). Wajah orang lain ditolak
 *   walau ter-enroll. Dipakai di panel absen pribadi (AttendanceKioskPanel).
 *   Bila kosong → MODE 1:N (kiosk bersama: kenali siapa pun yang ter-enroll).
 */
export function useClockKiosk(outletId: string, options?: { lockToStaffId?: string }) {
  const lockToStaffId = options?.lockToStaffId;
  const supabase = createClient();
  const queue = useAttendanceQueue();

  const candidatesRef = useRef<Candidate[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const locationLockedRef = useRef(false);
  const livenessWarningStartRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<KioskPhase>("locating");
  const [outletCoords, setOutletCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [result, setResult] = useState<KioskResult | null>(null);

  const [permissionState, setPermissionState] = useState<"prompt" | "requesting" | "denied" | "granted">("prompt");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // FEATURE FLAG / TOGGLE: Server Match (Opsi 1) vs Client Match (Legacy)
  const [matchMode, setMatchMode] = useState<"server" | "client">((process.env.NEXT_PUBLIC_FACE_MATCH_MODE as "server" | "client") || "server");
  const [serverDescriptor, setServerDescriptor] = useState<number[] | null>(null);
  const lastTickRef = useRef<number>(0);
  const lastLivenessRef = useRef<number>(0);

  // Check initial permissions state on mount and add listeners for settings updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkPermissions = async () => {
      try {
        if (navigator.permissions) {
          const [camPerm, geoPerm] = await Promise.all([
            navigator.permissions.query({ name: "camera" as any }).catch(() => null),
            navigator.permissions.query({ name: "geolocation" as any }).catch(() => null),
          ]);

          if (camPerm?.state === "granted" && geoPerm?.state === "granted") {
            setPermissionState("granted");
            setPermissionError(null);
            return;
          }
          if (camPerm?.state === "denied" || geoPerm?.state === "denied") {
            setPermissionState("denied");
            let errStr = "Izin ditolak oleh pengguna atau browser. Silakan aktifkan di setelan situs.";
            if (camPerm?.state === "denied" && geoPerm?.state !== "denied") {
              errStr = "Izin kamera ditolak di setelan browser. Silakan izinkan akses kamera.";
            } else if (geoPerm?.state === "denied" && camPerm?.state !== "denied") {
              errStr = "Izin lokasi ditolak di setelan browser. Silakan izinkan akses lokasi.";
            }
            setPermissionError(errStr);
            return;
          }
          if (camPerm?.state === "prompt" || geoPerm?.state === "prompt") {
            setPermissionState("prompt");
            return;
          }
        }
      } catch (e) {
        console.warn("Permissions query error:", e);
      }
    };

    checkPermissions();

    // Re-check permissions when returning to the app window/tab
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        checkPermissions();
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, []);

  // Reset cached outlet coordinates and location lock when outletId changes
  useEffect(() => {
    setOutletCoords(null);
    locationLockedRef.current = false;
    setGpsDistance(null);
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, [outletId]);

  /** Validasi lokasi sebelum scan wajah. Radius = GEOFENCE_RADIUS_M (lib/gps). */
  const checkLocation = useCallback(async () => {
    if (!outletId) return;
    setPhase("locating");
    setResult(null);

    // 1. Dapatkan koordinat outlet yang selalu fresh dari DB untuk outletId aktif
    let coords: { lat: number; lng: number } | null = null;
    try {
      const { data, error } = await supabase
        .from("outlets")
        .select("lat, lng, is_active")
        .eq("id", outletId)
        .single();

      if (error || !data) {
        console.error("Failed to load outlet coordinates for outletId:", outletId, error);
        setResult({ ok: false, message: "Gagal memuat koordinat outlet" });
        setPhase("location_invalid");
        return;
      }

      if (data.is_active === false) {
        setResult({ ok: false, message: "Kamera absensi sedang dinonaktifkan oleh Pusat (Emergency Lock)." });
        setPhase("locked");
        return;
      }

      // Jika lat/lng di DB bernilai null (misalnya HQ), bypass validasi geofence
      if (data.lat === null || data.lng === null) {
        locationLockedRef.current = true;
        setPhase("idle");
        setResult(null);
        return;
      }

      coords = { lat: Number(data.lat), lng: Number(data.lng) };
      setOutletCoords(coords);
    } catch (err) {
      console.error("Error loading outlet coordinates:", err);
      setResult({ ok: false, message: "Terjadi kesalahan sistem memuat lokasi outlet" });
      setPhase("location_invalid");
      return;
    }

    // Helper fungsi untuk memproses koordinat lokasi perangkat
    const handleLocationPosition = (pos: GeolocationPosition, targetOutletCoords: { lat: number; lng: number } | null): boolean => {
      const currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const accuracy = pos.coords.accuracy;
      setDeviceCoords(currentCoords);
      setDeviceAccuracy(accuracy);

      // Deteksi sinyal mock location / Fake GPS buatan
      const isMockSignal = 
        Boolean((pos.coords as any).isMock || (pos.coords as any).mocked) ||
        (accuracy === 1.0 || accuracy === 0.0);

      if (isMockSignal) {
        setResult({
          ok: false,
          message: "Lokasi Fake GPS / Mock Location Terdeteksi! Harap matikan aplikasi pemalsu lokasi di HP Anda dan gunakan GPS asli.",
        });
        setPhase("location_invalid");
        return false;
      }

      // Akurasi GPS terlalu rendah → tolak tegas.
      if (!isGpsAccuracyAcceptable(accuracy)) {
        setResult({
          ok: false,
          message: `Akurasi GPS terlalu rendah (${accuracy.toFixed(0)} m, maksimal ${MAX_GPS_ACCURACY_M} m). Aktifkan "Lokasi Akurat/Precise" dan nyalakan GPS HP Anda, lalu coba lagi.`,
        });
        setPhase("location_invalid");
        return false;
      }

      if (!targetOutletCoords) {
        locationLockedRef.current = true;
        setPhase("idle");
        setResult(null);
        return true;
      }

      const dist = haversineMeters(targetOutletCoords, currentCoords);
      setGpsDistance(dist);

      const adjustedDist = Math.max(0, dist - accuracy);
      if (adjustedDist <= GEOFENCE_RADIUS_M) {
        locationLockedRef.current = true;
        setPhase("idle");
        setResult(null);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        return true;
      } else {
        const msg = `Di luar jangkauan (Jarak Anda: ${formatDistanceMeters(dist, true)}, batas: ${formatDistanceMeters(GEOFENCE_RADIUS_M, true)}, Akurasi GPS: ${formatDistanceMeters(accuracy, true)}). Silakan mendekat ke area kasir.`;
        setResult({ ok: false, message: msg });
        setPhase("location_invalid");
        return false;
      }
    };

    // 2. PROBE 1: Ambil lokasi secara INSTAN (Fast Fix) dalam orde milidetik tanpa membuat user menunggu
    navigator.geolocation.getCurrentPosition(
      (pos) => handleLocationPosition(pos, coords),
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
    );

    // 3. PROBE 2: Jalankan pemindaian presisi di background
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handleLocationPosition(pos, coords),
      (err) => {
        // Jika Probe 1 sudah meloloskan lokasi, abaikan error background Probe 2
        if (locationLockedRef.current) return;

        console.error("Geolocation watch error:", { code: err.code, message: err.message });
        let errMsg = "Gagal memindai lokasi perangkat";
        if (err.code === err.PERMISSION_DENIED) {
          errMsg = "Izin lokasi ditolak. Harap izinkan akses lokasi pada browser Anda.";
          setPermissionState("denied");
          setPermissionError(errMsg);
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errMsg = "Sinyal GPS/lokasi tidak terdeteksi. Silakan aktifkan GPS HP Anda dan coba lagi.";
        } else if (err.code === err.TIMEOUT) {
          errMsg = "Waktu pemindaian lokasi habis. Pastikan GPS HP aktif dan coba lagi.";
        }
        setResult({ ok: false, message: errMsg });
        setPhase("location_invalid");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [outletId, outletCoords, supabase]);

  /** Handshake/Pemicu Izin Browser lewat interaksi user (Tombol UI) */
  const requestPermissions = useCallback(async () => {
    setPermissionState("requesting");
    setPermissionError(null);

    let cameraSuccess = false;
    let cameraErr: any = null;
    let locationSuccess = false;
    let locationErr: any = null;

    // 1. Request Camera Permission (uses ideal facingMode fallback to prevent OverconstrainedError)
    if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        stream.getTracks().forEach((t) => t.stop());
        cameraSuccess = true;
      } catch (err: any) {
        console.error("Camera permission request failed:", err);
        cameraErr = err;
      }
    } else {
      cameraErr = new Error("Browser tidak mendukung kamera.");
    }

    // 2. Request Geolocation Permission (executed independently so popup prompt shows even if camera failed)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
        locationSuccess = true;
      } catch (err: any) {
        console.error("Geolocation permission request failed:", err);
        locationErr = err;
      }
    } else {
      locationErr = new Error("Browser tidak mendukung geolokasi GPS.");
    }

    if (cameraSuccess && locationSuccess) {
      setPermissionState("granted");
      setPermissionError(null);
      checkLocation();
    } else {
      setPermissionState("denied");
      let msg = "Gagal mendapatkan izin browser.";
      if (!cameraSuccess && !locationSuccess) {
        msg = "Izin kamera dan lokasi ditolak oleh pengguna atau browser. Silakan aktifkan di setelan situs.";
      } else if (!cameraSuccess) {
        msg = cameraErr?.name === "NotAllowedError" || cameraErr?.code === 1
          ? "Izin kamera ditolak di setelan browser. Silakan izinkan akses kamera."
          : `Gagal mengakses kamera: ${cameraErr?.message || cameraErr}`;
      } else if (!locationSuccess) {
        msg = locationErr?.code === 1 || locationErr?.name === "NotAllowedError"
          ? "Izin lokasi ditolak di setelan browser. Silakan izinkan akses lokasi."
          : `Gagal mengakses lokasi GPS: ${locationErr?.message || locationErr}`;
      }
      setPermissionError(msg);
    }
  }, [checkLocation]);
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const busyRef = useRef(false);

  /** Muat descriptor staff ter-enroll. */
  const loadCandidates = useCallback(async () => {
    if (!outletId) return;
    let query = supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor,allow_manual_button")
      .or(`outlet_id.eq.${outletId},role.in.(spv,admin,owner,admin_hr,leader,korlap,regional_manager,area_manager)`)
      .not("face_descriptor", "is", null);
    // Mode 1:1 — batasi kandidat ke akun yang login saja (verifikasi, bukan identifikasi).
    if (lockToStaffId) query = query.eq("id", lockToStaffId);
    const { data } = await query;
    candidatesRef.current = ((data as StaffRow[]) ?? [])
      .filter((s) => s.face_descriptor)
      .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor!, allow_manual_button: s.allow_manual_button }));
  }, [outletId, lockToStaffId, supabase]);

  /** Tentukan aksi IN/OUT dari record hari ini. */
  const decideAction = useCallback(async (staffId: string): Promise<"in" | "out" | "done"> => {
    const todayLocalStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const start = new Date(`${todayLocalStr}T00:00:00+07:00`).toISOString();
    const end = new Date(`${todayLocalStr}T23:59:59+07:00`).toISOString();

    const { data } = await supabase
      .from("attendance")
      .select("type, status")
      .eq("outlet_staff_id", staffId)
      .gte("ts_server", start)
      .lte("ts_server", end)
      .order("ts_server", { ascending: false });

    // Pakai record TERBARU per tipe (in/out) — bukan yang pertama ditemukan —
    // agar percobaan absen masuk "alpha" yang lama tidak mengunci status hari ini
    // setelah ada percobaan susulan yang berhasil "tepat".
    const rows = (data as { type: string, status: string }[]) ?? [];
    const inRecord = rows.find(r => r.type === "in");
    const outRecord = rows.find(r => r.type === "out");

    if (!inRecord) return "in";
    if (!outRecord) return "out";
    return "done";
  }, [supabase]); // supabase is memoized — stable reference

  /** Dipanggil per-frame oleh layar saat phase idle: deteksi + identify. */
  const tick = useCallback(async (video: HTMLVideoElement) => {
    if (busyRef.current || phase !== "idle" || !outletId) return;
    
    // THROTTLING: Batasi deteksi wajah (human.detect) maksimal ~4 FPS (setiap 250ms)
    // agar HP low-end tidak overheat/patah-patah
    const now = Date.now();
    if (now - lastTickRef.current < 250) return;
    lastTickRef.current = now;

    busyRef.current = true;
    try {
      const human = await getHuman();
      const res = await human.detect(video);
      if (!res.face || res.face.length === 0 || !res.face[0].embedding) return;
      
      let foundId = "unknown";
      let foundName = "Unknown";
      let foundSim = 0;

      if (matchMode === "client") {
        // --- MODE KLIEN (LEGACY) ---
        const found = identifyStaff(Array.from(res.face[0].embedding), candidatesRef.current);
        foundId = found.id;
        foundName = found.name;
        foundSim = found.bestSimilarity;
      } else {
        // --- MODE SERVER (OPSI 1) ---
        const desc = Array.from(res.face[0].embedding);
        const apiRes = await fetch("/api/face-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptor: desc, outletId, lockToStaffId })
        });
        const data = await apiRes.json();
        
        if (data.ok && data.staffId) {
          foundId = data.staffId;
          foundName = data.name;
          foundSim = data.similarity;
          if (data.descriptor) {
            setServerDescriptor(data.descriptor);
          }
        } else {
          foundSim = data.bestSimilarity || 0;
        }
      }

      if (foundId === "unknown") {
        const msg = lockToStaffId
          ? `Wajah tidak cocok dengan akun ini. Pastikan Anda yang absen. (Skor: ${foundSim.toFixed(4)})`
          : `Wajah tidak dikenal (Skor kemiripan tertinggi: ${foundSim.toFixed(4)})`;
        setResult({ ok: false, message: msg });
        setPhase("result");
        scheduleReset(3000);
        return;
      }
      const next = await decideAction(foundId);

      if (next === "done") {
        setWho({ id: foundId, name: foundName });
        setResult({ ok: true, message: `${foundName} sudah absen masuk & keluar hari ini` });
        setPhase("result");
        scheduleReset(2500);
        return;
      }

      // Gate absen pulang: checklist penutupan (fase "tutup") wajib selesai dulu.
      if (next === "out" && !(await isClosingChecklistDone())) {
        setResult({ ok: false, message: "Checklist penutupan belum selesai. Tidak bisa absen pulang." });
        setPhase("result");
        scheduleReset(3500);
        return;
      }

      // Gate absen pulang: shift kasir (laci) outlet ini wajib sudah ditutup.
      if (next === "out" && !(await isShiftClosed())) {
        setResult({ ok: false, message: "Shift kasir outlet ini belum ditutup (Petty Cash). Tidak bisa absen pulang." });
        setPhase("result");
        scheduleReset(3500);
        return;
      }

      setWho({ id: foundId, name: foundName });
      setAction(next);
      setChallenge(pickChallenge());
      setPhase("identified");
      setTimeout(() => setPhase("liveness"), 900); // jeda salam "Halo, Nama"
    } finally {
      busyRef.current = false;
    }
  }, [phase, outletId, decideAction, matchMode, lockToStaffId]);

  /** Dipanggil per-frame saat phase liveness; selesaikan saat lulus. */
  const livenessRef = useRef<ReturnType<typeof createLivenessDetector> | null>(null);
  const runLiveness = useCallback(async (video: HTMLVideoElement) => {
    if (phase !== "liveness" || !who || !challenge || !outletId) return;
    
    // THROTTLING untuk liveness agar tidak terlalu berat
    const now = Date.now();
    if (now - lastLivenessRef.current < 200) return; // ~5 FPS
    lastLivenessRef.current = now;

    if (busyRef.current) return;
    busyRef.current = true;
    // Pastikan detector ada lalu pegang referensinya di variabel lokal. Selama
    // `await` deteksi di bawah, scheduleReset bisa men-null-kan livenessRef.current —
    // memakai variabel lokal mencegah crash "reading 'feed' of null".
    if (!livenessRef.current) livenessRef.current = createLivenessDetector(challenge);
    const detector = livenessRef.current;
    try {
      const human = await getHuman();
      const res = await human.detect(video);
      
      // Bila wajah hilang atau terdeteksi lebih dari satu wajah, batalkan liveness untuk mencegah pergantian orang
      if (!res.face || res.face.length !== 1 || livenessRef.current !== detector) {
        if (livenessRef.current === detector) {
          setResult({ ok: false, message: res.face && res.face.length > 1 ? "Terdeteksi lebih dari satu wajah. Proses dibatalkan." : "Wajah keluar dari frame. Proses dibatalkan." });
          setPhase("result");
          scheduleReset(2500);
        }
        return;
      }
      // Evaluasi identitas per-frame dengan toleransi 3 detik.
      // Jika wajah menoleh, descriptor bisa melenceng dan dianggap "unknown". 
      // Jeda 3 detik memberi waktu untuk menyelesaikan gerakan tanpa langsung gagal.
      let isFaceMatch = false;
      if (res.face[0].embedding) {
        const liveDesc = Array.from(res.face[0].embedding);
        if (matchMode === "server" && serverDescriptor) {
          // Hanya bandingkan dengan descriptor yang dikembalikan oleh server (Opsi 1)
          const found = identifyStaff(liveDesc, [{ id: who.id, name: who.name, descriptor: serverDescriptor }]);
          isFaceMatch = (found.id === who.id);
        } else {
          // Bandingkan dengan seluruh kandidat (Mode Legacy Client)
          const found = identifyStaff(liveDesc, candidatesRef.current);
          isFaceMatch = (found.id === who.id);
        }
      }

      if (!isFaceMatch) {
        if (!livenessWarningStartRef.current) {
          livenessWarningStartRef.current = Date.now();
        }
        if (Date.now() - livenessWarningStartRef.current > 3000) {
          setResult({ ok: false, message: "Wajah harus orang yang sama. Proses dibatalkan." });
          setPhase("result");
          scheduleReset(3000);
          return;
        } else {
          // Hanya tampilkan warning jika belum ada result gagal sebelumnya
          setResult((prev) => prev?.ok === false && prev.message.includes("dibatalkan") 
            ? prev 
            : { ok: false, message: "Wajah tidak cocok, silakan paskan wajah Anda kembali" });
        }
      } else {
        livenessWarningStartRef.current = null;
        setResult((prev) => prev?.message === "Wajah tidak cocok, silakan paskan wajah Anda kembali" ? null : prev);
      }

      // Tetap feed detector agar gerakan (menengok dll) diproses selama masa toleransi.
      const passed = detector.feed(res.gesture);
      if (passed) {
        livenessRef.current = null;
        // Pengecekan final saat lolos liveness (harus frontal dan cocok)
        if (!res.face[0].embedding) return;
        const liveDesc = Array.from(res.face[0].embedding);
        
        let finalMatch = false;
        let finalSim = 0;
        
        if (matchMode === "server" && serverDescriptor) {
          const found = identifyStaff(liveDesc, [{ id: who.id, name: who.name, descriptor: serverDescriptor }]);
          finalMatch = (found.id === who.id);
          finalSim = found.bestSimilarity;
        } else {
          const found = identifyStaff(liveDesc, candidatesRef.current);
          finalMatch = (found.id === who.id);
          finalSim = found.bestSimilarity;
        }

        if (!finalMatch) {
          setResult({ ok: false, message: `Wajah harus orang yang sama. Silakan ulangi. (Skor: ${finalSim.toFixed(4)})` });
          setPhase("result");
          scheduleReset(3000);
          return;
        }
        await doSubmit(video);
      }
    } finally {
      busyRef.current = false;
    }
  }, [phase, who, challenge, outletId, matchMode, serverDescriptor]);

  /**
   * True bila semua item WAJIB pada checklist fase "tutup" sudah dicentang hari ini.
   * Dipakai untuk menggate absen pulang. Aman bila kolom phase belum ada / belum ada
   * checklist tutup → mengembalikan true (tidak menghalangi).
   */
  async function isClosingChecklistDone(): Promise<boolean> {
    if (!outletId) return true;
    const GLOBAL_OUTLET_ID = '00000000-0000-0000-0000-000000000000';
    const { data: cats } = await supabase
      .from("checklist_categories")
      .select("id, checklist_items(id, is_required)")
      .in("outlet_id", [outletId, GLOBAL_OUTLET_ID])
      .eq("phase", "tutup");
    const requiredIds = ((cats as any[]) ?? [])
      .flatMap((c) => c.checklist_items ?? [])
      .filter((i: any) => i.is_required)
      .map((i: any) => i.id as string);
    if (requiredIds.length === 0) return true;

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD lokal (samakan dgn kru-checklist)
    const { data: rec } = await supabase
      .from("daily_checklist_records")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("date", today)
      .maybeSingle();
    if (!rec) return false; // belum ada record → belum diceklis sama sekali

    const { data: ticks } = await supabase
      .from("daily_checklist_ticks")
      .select("item_id")
      .eq("record_id", rec.id);
    const ticked = new Set(((ticks as any[]) ?? []).map((t) => t.item_id as string));
    return requiredIds.every((id) => ticked.has(id));
  }

  /**
   * True bila TIDAK ada shift kasir yang masih terbuka (status='open') di outlet ini.
   * Shift adalah state milik OUTLET (laci bersama), bukan milik staf tertentu — jadi
   * ini berlaku untuk siapa pun yang absen pulang di outlet tsb, terlepas dari siapa
   * yang membuka shift. Tidak ada bypass (sesuai desain checklist-gate di atas).
   */
  async function isShiftClosed(): Promise<boolean> {
    if (!outletId) return true;
    const { data } = await supabase
      .from("shifts")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("status", "open")
      .maybeSingle();
    return !data;
  }

  async function doSubmit(video: HTMLVideoElement) {
    if (!who || !outletId) return;
    setPhase("submitting");
    const { dataUrl } = captureFrame(video);
    const id = crypto.randomUUID();
    const payload: AttendancePayload & { outlet_id: string } = {
      id,
      outlet_id: outletId,
      outlet_staff_id: who.id,
      type: action,
      gps_lat: deviceCoords?.lat ?? null,
      gps_lng: deviceCoords?.lng ?? null,
      gps_accuracy: deviceAccuracy ?? null,
      is_mock: (deviceAccuracy === 1.0 || deviceAccuracy === 0.0),
      match_distance: 0,
      selfie_path: null,
      ts_client: new Date().toISOString(),
      from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      postToNative({ type: "haptic", style: "success" }); // no-op di luar WebView
      setResult({ ok: true, message: action === "in" ? "Selamat bekerja! (Offline)" : "Hati-hati di jalan! (Offline)" });
      setPhase("result"); scheduleReset(2500); return;
    }

    const path = `${outletId}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    const { error: uploadErr } = await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (uploadErr) console.error("Selfie upload err:", uploadErr);
    
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeaderToken = typeof window !== 'undefined' && localStorage.getItem('supabase-auth-token')
      ? JSON.parse(localStorage.getItem('supabase-auth-token') || '{}')?.session?.access_token
      : null;
    const token = authHeaderToken || anonKey;
    const res = await submitAttendance({ ...payload, selfie_path: path }, { functionUrl: FUNCTION_URL, anonKey: token });
    postToNative({ type: "haptic", style: res.ok ? "success" : "error" }); // no-op di luar WebView
    setResult(res.ok
      ? { ok: true, message: action === "in" ? "Selamat bekerja!" : "Hati-hati di jalan!" }
      : { ok: false, message: gagalText(res.reason) });
    setPhase("result");
    scheduleReset(res.ok ? 2500 : 1000);
  }

  async function doSubmitManual(staffId: string, staffName: string) {
    if (!outletId) return;
    if (busyRef.current || (phase !== "idle" && phase !== "result" && phase !== "locating")) return;
    busyRef.current = true;
    try {
      const nextAction = await decideAction(staffId);
      if (nextAction === "done") {
        setResult({ ok: true, message: `${staffName} sudah absen masuk & keluar hari ini` });
        setPhase("result"); scheduleReset(2500); return;
      }
      
      if (nextAction === "out" && !(await isClosingChecklistDone())) {
        setResult({ ok: false, message: "Checklist penutupan belum selesai. Tidak bisa absen pulang." });
        setPhase("result"); scheduleReset(3500); return;
      }
      if (nextAction === "out" && !(await isShiftClosed())) {
        setResult({ ok: false, message: "Shift kasir outlet ini belum ditutup (Petty Cash). Tidak bisa absen pulang." });
        setPhase("result"); scheduleReset(3500); return;
      }

      setPhase("submitting");
      const id = crypto.randomUUID();
      const payload: AttendancePayload & { outlet_id: string } = {
        id,
        outlet_id: outletId,
        outlet_staff_id: staffId,
        type: nextAction,
        gps_lat: deviceCoords?.lat ?? null,
        gps_lng: deviceCoords?.lng ?? null,
        gps_accuracy: deviceAccuracy ?? null,
        is_mock: (deviceAccuracy === 1.0 || deviceAccuracy === 0.0),
        match_distance: 0,
        selfie_path: null,
        ts_client: new Date().toISOString(),
        from_queue: false,
        is_manual_button: true,
      };

      if (!navigator.onLine) {
        queue.enqueue(payload, "");
        postToNative({ type: "haptic", style: "success" });
        setResult({ ok: true, message: nextAction === "in" ? "Selamat bekerja! (Offline)" : "Hati-hati di jalan! (Offline)" });
        setPhase("result"); scheduleReset(2500); return;
      }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const authHeaderToken = typeof window !== 'undefined' && localStorage.getItem('supabase-auth-token')
        ? JSON.parse(localStorage.getItem('supabase-auth-token') || '{}')?.session?.access_token
        : null;
      const token = authHeaderToken || anonKey;
      const res = await submitAttendance(payload, { functionUrl: FUNCTION_URL, anonKey: token });
      postToNative({ type: "haptic", style: res.ok ? "success" : "error" });
      setResult(res.ok
        ? { ok: true, message: nextAction === "in" ? "Selamat bekerja!" : "Hati-hati di jalan!" }
        : { ok: false, message: gagalText(res.reason) });
      setPhase("result"); scheduleReset(res.ok ? 2500 : 1000);
    } finally {
      busyRef.current = false;
    }
  }

  // Bersihkan Geolocation Watcher saat komponen unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function scheduleReset(delay = 2500) {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTimeout(() => {
      setPhase(locationLockedRef.current ? "idle" : "locating");
      setWho(null); setChallenge(null); setResult(null);
      setServerDescriptor(null);
      livenessRef.current = null;
      livenessWarningStartRef.current = null;
    }, delay);
  }

  /** Flush antrian offline saat online. */
  const flushQueue = useCallback(() => {
    if (outletId && navigator.onLine) queue.flush(outletId);
  }, [outletId, queue]);

  /** Kalibrasi ulang koordinat outlet ke posisi fisik saat ini */
  return { phase, who, action, challenge, challengeLabel: challenge ? CHALLENGE_LABEL[challenge] : "", result,
           loadCandidates, tick, runLiveness, flushQueue, isOnline: queue.isOnline, pending: queue.pending,
           checkLocation, gpsDistance, deviceCoords, deviceAccuracy,
           permissionState, permissionError, requestPermissions,
           matchMode, setMatchMode, doSubmitManual };
}

function gagalText(reason: string): string {
  const map: Record<string, string> = {
    not_enrolled: "Belum enroll wajah",
    forbidden_role: "Akun tak berwenang absen",
    cross_outlet: "Staff beda outlet",
    unauthenticated: "API key salah",
    terlambat_alpha: "Lewat Batas Waktu (Alpha)",
    too_early_in: "Belum waktunya absen masuk",
    too_early_out: "Belum waktunya absen pulang",
    gps_accuracy_low: "Akurasi GPS terlalu rendah — aktifkan Lokasi Akurat",
    shift_not_closed: "Shift kasir belum ditutup",
    unfinished_orders: "Masih ada pesanan yang belum selesai di outlet ini",
  };
  return map[reason] ?? `Gagal: ${reason}`;
}
