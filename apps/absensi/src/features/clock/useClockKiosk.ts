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

type StaffRow = { id: string; name: string; face_descriptor: number[] | null };

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

  /** Validasi lokasi sebelum scan wajah. Radius = GEOFENCE_RADIUS_M (lib/gps). */
  const checkLocation = useCallback(async () => {
    if (!outletId) return;
    setPhase("locating");
    setResult(null);

    // Cek apakah lokasi sudah terverifikasi hari ini (cache dihapus karena server butuh lat/lng realtime)


    // 1. Dapatkan koordinat outlet dari DB jika belum dimuat
    let coords = outletCoords;
    if (!coords) {
      try {
        const { data, error } = await supabase
          .from("outlets")
          .select("lat, lng, is_active")
          .eq("id", outletId)
          .single();
        if (error || !data) {
          console.error("Failed to load outlet coordinates:", error);
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
    }

    // 2. Ambil lokasi perangkat secara kontinu (watchPosition)
    if (typeof window === "undefined" || !navigator.geolocation) {
      setResult({ ok: false, message: "Browser tidak mendukung fitur geolokasi" });
      setPhase("location_invalid");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = pos.coords.accuracy;
        setDeviceCoords(currentCoords);
        setDeviceAccuracy(accuracy);

        // Akurasi GPS terlalu rendah → tolak tegas (jangan loloskan ke idle).
        if (!isGpsAccuracyAcceptable(accuracy)) {
          setResult({
            ok: false,
            message: `Akurasi GPS terlalu rendah (${accuracy.toFixed(0)} m, maksimal ${MAX_GPS_ACCURACY_M} m). Aktifkan "Lokasi Akurat/Precise" dan nyalakan GPS HP Anda, lalu coba lagi.`,
          });
          setPhase("location_invalid");
          return;
        }

        if (!coords) {
          locationLockedRef.current = true;
          setPhase("idle");
          setResult(null);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          return;
        }

        const dist = haversineMeters(coords, currentCoords);
        setGpsDistance(dist);

        // Toleransi akurasi dinamis: Jarak - Akurasi GPS <= GEOFENCE_RADIUS_M (mengompensasi GPS drift indoor)
        const adjustedDist = Math.max(0, dist - accuracy);

        if (adjustedDist <= GEOFENCE_RADIUS_M) {


          locationLockedRef.current = true;
          setPhase("idle");
          setResult(null);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
        } else {
          let msg = `Di luar jangkauan (Jarak Anda: ${formatDistanceMeters(dist, true)}, batas: ${formatDistanceMeters(GEOFENCE_RADIUS_M, true)}, Akurasi GPS: ${formatDistanceMeters(accuracy, true)}). Silakan mendekat ke area kasir.`;
          setResult({
            ok: false,
            message: msg,
          });
          setPhase("location_invalid");
        }
      },
      (err) => {
        console.error("Geolocation error:", { code: err.code, message: err.message });
        let errMsg = "Gagal memindai lokasi perangkat";
        if (err.code === err.PERMISSION_DENIED) {
          errMsg = "Izin lokasi ditolak. Harap izinkan akses lokasi pada browser Anda.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errMsg = "Sinyal GPS/lokasi tidak terdeteksi. Silakan coba lagi.";
        } else if (err.code === err.TIMEOUT) {
          errMsg = "Waktu pemindaian lokasi habis (Timeout). Coba lagi.";
        }
        setResult({ ok: false, message: errMsg });
        setPhase("location_invalid");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [outletId, outletCoords, supabase]);
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const busyRef = useRef(false);

  /** Muat descriptor staff ter-enroll. */
  const loadCandidates = useCallback(async () => {
    if (!outletId) return;
    let query = supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletId)
      .not("face_descriptor", "is", null);
    // Mode 1:1 — batasi kandidat ke akun yang login saja (verifikasi, bukan identifikasi).
    if (lockToStaffId) query = query.eq("id", lockToStaffId);
    const { data } = await query;
    candidatesRef.current = ((data as StaffRow[]) ?? [])
      .filter((s) => s.face_descriptor)
      .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor! }));
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
    busyRef.current = true;
    try {
      const human = await getHuman();
      const res = await human.detect(video);
      if (!res.face || res.face.length === 0 || !res.face[0].embedding) return;
      const found = identifyStaff(Array.from(res.face[0].embedding), candidatesRef.current);
      if (found.id === "unknown") {
        const msg = lockToStaffId
          ? `Wajah tidak cocok dengan akun ini. Pastikan Anda yang absen. (Skor: ${found.bestSimilarity.toFixed(4)})`
          : `Wajah tidak dikenal (Skor kemiripan tertinggi: ${found.bestSimilarity.toFixed(4)})`;
        setResult({ ok: false, message: msg });
        setPhase("result");
        scheduleReset(3000);
        return;
      }
      const next = await decideAction(found.id);

      if (next === "done") {
        setWho({ id: found.id, name: found.name });
        setResult({ ok: true, message: `${found.name} sudah absen masuk & keluar hari ini` });
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

      setWho({ id: found.id, name: found.name });
      setAction(next);
      setChallenge(pickChallenge());
      setPhase("identified");
      setTimeout(() => setPhase("liveness"), 900); // jeda salam "Halo, Nama"
    } finally {
      busyRef.current = false;
    }
  }, [phase, outletId, decideAction]);

  /** Dipanggil per-frame saat phase liveness; selesaikan saat lulus. */
  const livenessRef = useRef<ReturnType<typeof createLivenessDetector> | null>(null);
  const runLiveness = useCallback(async (video: HTMLVideoElement) => {
    if (phase !== "liveness" || !who || !challenge || !outletId) return;
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
        const found = identifyStaff(Array.from(res.face[0].embedding), candidatesRef.current);
        isFaceMatch = (found.id === who.id);
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
        const found = identifyStaff(Array.from(res.face[0].embedding), candidatesRef.current);
        if (found.id === "unknown" || found.id !== who.id) {
          setResult({ ok: false, message: `Wajah harus orang yang sama. Silakan ulangi. (Skor: ${found.bestSimilarity.toFixed(4)})` });
          setPhase("result");
          scheduleReset(3000);
          return;
        }
        await doSubmit(video);
      }
    } finally {
      busyRef.current = false;
    }
  }, [phase, who, challenge, outletId]);

  /**
   * True bila semua item WAJIB pada checklist fase "tutup" sudah dicentang hari ini.
   * Dipakai untuk menggate absen pulang. Aman bila kolom phase belum ada / belum ada
   * checklist tutup → mengembalikan true (tidak menghalangi).
   */
  async function isClosingChecklistDone(): Promise<boolean> {
    if (!outletId) return true;
    const { data: cats } = await supabase
      .from("checklist_categories")
      .select("id, checklist_items(id, is_required)")
      .eq("outlet_id", outletId)
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

  // Bersihkan Geolocation Watcher saat komponen unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function scheduleReset(delay = 2500) {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTimeout(() => {
      setPhase(locationLockedRef.current ? "idle" : "locating");
      setWho(null); setChallenge(null); setResult(null);
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
           checkLocation, gpsDistance, deviceCoords, deviceAccuracy };
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
  };
  return map[reason] ?? `Gagal: ${reason}`;
}
