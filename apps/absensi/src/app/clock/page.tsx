"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useAuth } from "@/context/AuthContext";
import { useClockKiosk } from "@/features/clock/useClockKiosk";

export default function ClockPage() {
  const { outletStaff } = useAuth();
  const kiosk = useClockKiosk();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);
  const tickRef = useRef(kiosk.tick);
  tickRef.current = kiosk.tick;
  const runLivenessRef = useRef(kiosk.runLiveness);
  runLivenessRef.current = kiosk.runLiveness;
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => { loadFaceModels(); }, []);
  useEffect(() => { if (outletStaff) { kiosk.loadCandidates(); kiosk.flushQueue(); } }, [outletStaff]);

  // Loop deteksi: jalankan tick/liveness sesuai phase.
  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        if (kiosk.phase === "idle") tickRef.current(v);
        else if (kiosk.phase === "liveness") runLivenessRef.current(v);
      }
      loopRef.current = window.setTimeout(loop, 350);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase]);

  const ringColor =
    kiosk.phase === "idle" ? "border-gray-400 border-dashed" :
    kiosk.phase === "result" && !kiosk.result?.ok ? "border-red-500" : "border-suka-green";

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-suka-brown">Absensi</h1>
        {!kiosk.isOnline && (
          <span className="text-xs text-amber-600">Offline · {kiosk.pending} menunggu sync</span>
        )}
      </div>

      <Card className="relative overflow-hidden p-0">
        <div className="relative">
          <CameraCapture onReady={(v) => (videoRef.current = v)} onError={setCameraError} />
          <div className={`pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-full border-4 ${ringColor}`} />
        </div>

        <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
          {cameraError ? (
            <p className="flex items-center gap-2 text-red-600"><CircleX size={18} /> {cameraError}</p>
          ) : (
            <>
              {kiosk.phase === "idle" && (
                <p className="flex items-center gap-2 text-gray-500"><UserRound size={18} /> Menghadap kamera…</p>
              )}
              {kiosk.phase === "identified" && (
                <p className="text-lg font-medium text-suka-ink">Halo, {kiosk.who?.name}</p>
              )}
              {kiosk.phase === "liveness" && (
                <>
                  <p className="text-sm text-gray-500">Halo, {kiosk.who?.name} · {kiosk.action === "in" ? "Clock-in" : "Clock-out"}</p>
                  <p className="flex items-center gap-2 rounded-md border border-suka-orange bg-suka-cream px-3 py-2 font-medium text-suka-brown">
                    <Eye size={18} /> {kiosk.challengeLabel}
                  </p>
                </>
              )}
              {kiosk.phase === "submitting" && <Spinner />}
              {kiosk.phase === "result" && kiosk.result && (
                <p className={`flex items-center gap-2 text-lg font-medium ${kiosk.result.ok ? "text-suka-green" : "text-red-600"}`}>
                  {kiosk.result.ok ? <CircleCheck size={22} /> : <CircleX size={22} />} {kiosk.result.message}
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Hadapkan wajah ke kamera. Sistem mengenali otomatis lalu meminta satu gerakan acak.
      </p>
    </div>
  );
}
