"use client";

import { useCallback, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { captureFrame } from "@/components/CameraCapture";
import { identifyStaff, type Candidate } from "@/lib/face/identify";
import {
  createLivenessDetector, featuresFromLandmarks, pickChallenge,
  CHALLENGE_LABEL, type Challenge,
} from "@/lib/face/liveness";
import { submitAttendance } from "@/lib/attendance/submit";
import { useAttendanceQueue } from "@/lib/attendance/useAttendanceQueue";
import type { AttendancePayload } from "@/lib/attendance/types";

export type KioskPhase = "idle" | "identified" | "liveness" | "submitting" | "result";
export type KioskResult = { ok: boolean; message: string };

type StaffRow = { id: string; name: string; face_descriptor: number[] | null };

const FUNCTION_URL = "/api/submit-attendance";
// inputSize 160 gagal mendeteksi wajah saat menoleh (liveness turn-left/turn-right)
// karena resolusi terlalu rendah untuk wajah non-frontal. 224 + scoreThreshold lebih
// rendah memberi cukup detail tanpa menambah beban berarti (deteksi tetap event-based).
const DETECT_OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

export function useClockKiosk(outletId: string) {
  const supabase = createClient();
  const queue = useAttendanceQueue();

  const candidatesRef = useRef<Candidate[]>([]);
  const [phase, setPhase] = useState<KioskPhase>("idle");
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [result, setResult] = useState<KioskResult | null>(null);
  const busyRef = useRef(false);

  /** Muat descriptor staff ter-enroll. */
  const loadCandidates = useCallback(async () => {
    if (!outletId) return;
    const { data } = await supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletId)
      .not("face_descriptor", "is", null);
    candidatesRef.current = ((data as StaffRow[]) ?? [])
      .filter((s) => s.face_descriptor)
      .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor! }));
  }, [outletId, supabase]);

  /** Tentukan aksi IN/OUT dari record hari ini. */
  const decideAction = useCallback(async (staffId: string): Promise<"in" | "out" | "done"> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("type, status")
      .eq("outlet_staff_id", staffId)
      .gte("ts_server", `${today}T00:00:00`)
      .lte("ts_server", `${today}T23:59:59`)
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
  }, [supabase]);

  /** Dipanggil per-frame oleh layar saat phase idle: deteksi + identify. */
  const tick = useCallback(async (video: HTMLVideoElement) => {
    if (busyRef.current || phase !== "idle" || !outletId) return;
    busyRef.current = true;
    try {
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks().withFaceDescriptor();
      if (!det) return;
      const found = identifyStaff(Array.from(det.descriptor), candidatesRef.current);
      if (!found) {
        setResult({ ok: false, message: "Wajah tidak dikenal / Belum terdaftar" });
        setPhase("result");
        scheduleReset(1000);
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
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks().withFaceDescriptor();
      // Bila wajah hilang atau sesi sudah di-reset selama deteksi, berhenti diam-diam.
      if (!det || livenessRef.current !== detector) return;

      // Identitas TIDAK dicek per-frame saat menoleh (descriptor melenceng di sudut
      // → salah tolak "wajah berubah"). Tantangan baru lolos ketika wajah kembali ke
      // posisi TENGAH/frontal — di frame itulah descriptor andal, jadi verifikasi
      // identitas dilakukan tepat saat lolos. Ini mencegah celah "ganti orang di
      // tengah liveness" tanpa memunculkan false-reject saat menoleh.
      const passed = detector.feed(featuresFromLandmarks(det as any));
      if (passed) {
        livenessRef.current = null;
        const found = identifyStaff(Array.from(det.descriptor), candidatesRef.current, 0.55);
        if (!found || found.id !== who.id) {
          setResult({ ok: false, message: "Wajah harus orang yang sama. Silakan ulangi." });
          setPhase("result");
          scheduleReset(1500);
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
      match_distance: 0,
      selfie_path: null,
      ts_client: new Date().toISOString(),
      from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      setResult({ ok: true, message: action === "in" ? "Selamat bekerja! (Offline)" : "Hati-hati di jalan! (Offline)" });
      setPhase("result"); scheduleReset(2500); return;
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeaderToken = typeof window !== 'undefined' && localStorage.getItem('supabase-auth-token') 
      ? JSON.parse(localStorage.getItem('supabase-auth-token') || '{}')?.session?.access_token 
      : null;
    const token = authHeaderToken || anonKey;
    const res = await submitAttendance({ ...payload, selfie_base64: dataUrl }, { functionUrl: FUNCTION_URL, anonKey: token });
    setResult(res.ok
      ? { ok: true, message: action === "in" ? "Selamat bekerja!" : "Hati-hati di jalan!" }
      : { ok: false, message: gagalText(res.reason) });
    setPhase("result");
    scheduleReset(res.ok ? 2500 : 1000);
  }

  function scheduleReset(delay = 2500) {
    setTimeout(() => {
      setPhase("idle"); setWho(null); setChallenge(null); setResult(null);
      livenessRef.current = null;
    }, delay);
  }

  /** Flush antrian offline saat online. */
  const flushQueue = useCallback(() => {
    if (outletId && navigator.onLine) queue.flush(outletId);
  }, [outletId, queue]);

  return { phase, who, action, challenge, challengeLabel: challenge ? CHALLENGE_LABEL[challenge] : "", result,
           loadCandidates, tick, runLiveness, flushQueue, isOnline: queue.isOnline, pending: queue.pending };
}

function gagalText(reason: string): string {
  const map: Record<string, string> = {
    not_enrolled: "Belum enroll wajah",
    forbidden_role: "Akun tak berwenang absen",
    cross_outlet: "Staff beda outlet",
    unauthenticated: "API key salah",
    terlambat_alpha: "Lewat Batas Waktu (Alpha)",
  };
  return map[reason] ?? `Gagal: ${reason}`;
}
