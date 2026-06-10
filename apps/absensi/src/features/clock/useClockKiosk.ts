"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;
const DETECT_OPTS = new faceapi.TinyFaceDetectorOptions();
const LIVENESS_TIMEOUT_MS = 8000;

export function useClockKiosk() {
  const { outletStaff, session } = useAuth();
  const supabase = createClient();
  const queue = useAttendanceQueue();

  const candidatesRef = useRef<Candidate[]>([]);
  const [phase, setPhase] = useState<KioskPhase>("idle");
  const [who, setWho] = useState<{ id: string; name: string; distance: number } | null>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [result, setResult] = useState<KioskResult | null>(null);
  const busyRef = useRef(false);
  const livenessStartRef = useRef<number>(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  /** Muat descriptor staff ter-enroll (panggil sekali setelah outletStaff siap). */
  const loadCandidates = useCallback(async () => {
    if (!outletStaff) return;
    const { data } = await supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletStaff.outlet_id)
      .not("face_descriptor", "is", null);
    candidatesRef.current = ((data as StaffRow[]) ?? [])
      .filter((s) => s.face_descriptor)
      .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor! }));
  }, [outletStaff, supabase]);

  /** Tentukan aksi IN/OUT dari record hari ini. */
  const decideAction = useCallback(async (staffId: string): Promise<"in" | "out" | "done"> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("type")
      .eq("outlet_staff_id", staffId)
      .gte("ts_server", `${today}T00:00:00`)
      .lte("ts_server", `${today}T23:59:59`);
    const types = (data as { type: string }[] ?? []).map((r) => r.type);
    const hasIn = types.includes("in");
    const hasOut = types.includes("out");
    if (!hasIn) return "in";
    if (!hasOut) return "out";
    return "done";
  }, [supabase]);

  /** Dipanggil per-frame oleh layar saat phase idle: deteksi + identify. */
  const tick = useCallback(async (video: HTMLVideoElement) => {
    if (busyRef.current || phase !== "idle" || !outletStaff) return;
    busyRef.current = true;
    try {
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks().withFaceDescriptor();
      if (!det) return;
      const found = identifyStaff(Array.from(det.descriptor), candidatesRef.current);
      if (!found) return;
      const next = await decideAction(found.id);
      if (next === "done") {
        setWho({ id: found.id, name: found.name, distance: found.distance });
        setResult({ ok: true, message: `${found.name} sudah absen masuk & keluar hari ini` });
        setPhase("result");
        scheduleReset();
        return;
      }
      setWho({ id: found.id, name: found.name, distance: found.distance });
      setAction(next);
      setChallenge(pickChallenge());
      setPhase("identified");
      setTimeout(() => { livenessStartRef.current = Date.now(); setPhase("liveness"); }, 900); // jeda salam "Halo, Nama"
    } finally {
      busyRef.current = false;
    }
  }, [phase, outletStaff, decideAction]);

  /** Dipanggil per-frame saat phase liveness; selesaikan saat lulus. */
  const livenessRef = useRef<ReturnType<typeof createLivenessDetector> | null>(null);
  const runLiveness = useCallback(async (video: HTMLVideoElement) => {
    if (phase !== "liveness" || !who || !challenge || !outletStaff) return;
    if (Date.now() - livenessStartRef.current > LIVENESS_TIMEOUT_MS) {
      livenessRef.current = null;
      setPhase("idle"); setWho(null); setChallenge(null);
      return;
    }
    if (!livenessRef.current) livenessRef.current = createLivenessDetector(challenge);
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks();
      if (!det) return;
      const passed = livenessRef.current.feed(featuresFromLandmarks(det as any));
      if (passed) {
        livenessRef.current = null;
        await doSubmit(video);
      }
    } finally {
      busyRef.current = false;
    }
  }, [phase, who, challenge, outletStaff]);

  async function doSubmit(video: HTMLVideoElement) {
    if (!who || !outletStaff) return;
    setPhase("submitting");
    const { dataUrl } = captureFrame(video);
    const id = crypto.randomUUID();
    const payload: AttendancePayload = {
      id,
      outlet_staff_id: who.id,
      type: action,
      match_distance: who.distance,
      selfie_path: null,
      ts_client: new Date().toISOString(),
      from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      setResult({ ok: true, message: `Tersimpan offline — sinkron saat online` });
      setPhase("result"); scheduleReset(); return;
    }

    const path = `${outletStaff.outlet_id}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg" });
    const token = session?.access_token;
    if (!token) { setResult({ ok: false, message: "Sesi habis, login ulang" }); setPhase("result"); scheduleReset(); return; }

    const res = await submitAttendance({ ...payload, selfie_path: path }, { functionUrl: FUNCTION_URL, accessToken: token });
    setResult(res.ok
      ? { ok: true, message: `${action === "in" ? "Masuk" : "Keluar"} · ${res.status}` }
      : { ok: false, message: gagalText(res.reason) });
    setPhase("result");
    scheduleReset();
  }

  function scheduleReset() {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setPhase("idle"); setWho(null); setChallenge(null); setResult(null);
      livenessRef.current = null;
      resetTimerRef.current = null;
    }, 2500);
  }

  /** Flush antrian offline saat online (panggil dari page saat outletStaff siap & online). */
  const flushQueue = useCallback(() => {
    if (outletStaff && navigator.onLine) queue.flush(outletStaff.outlet_id);
  }, [outletStaff, queue]);

  return { phase, who, action, challenge, challengeLabel: challenge ? CHALLENGE_LABEL[challenge] : "", result,
           loadCandidates, tick, runLiveness, flushQueue, isOnline: queue.isOnline, pending: queue.pending };
}

function gagalText(reason: string): string {
  const map: Record<string, string> = {
    not_enrolled: "Belum enroll wajah",
    forbidden_role: "Akun tak berwenang absen",
    cross_outlet: "Staff beda outlet",
    unauthenticated: "Sesi habis, login ulang",
  };
  return map[reason] ?? `Gagal: ${reason}`;
}
