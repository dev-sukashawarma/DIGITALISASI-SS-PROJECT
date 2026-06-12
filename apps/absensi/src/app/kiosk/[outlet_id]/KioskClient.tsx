"use client";

import { useEffect, useRef } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX, Store } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useAuth } from "@/context/AuthContext";
import { useClockKiosk } from "@/features/clock/useClockKiosk";

export function KioskClient({ outlet_id }: { outlet_id: string }) {
  const kiosk = useClockKiosk(outlet_id);
  const { outletStaff } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => { loadFaceModels(); }, []);
  useEffect(() => { if (outlet_id) { kiosk.loadCandidates(); kiosk.flushQueue(); } }, [outlet_id]);

  // Loop deteksi: jalankan tick/liveness sesuai phase.
  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        if (kiosk.phase === "idle") kiosk.tick(v);
        else if (kiosk.phase === "liveness") kiosk.runLiveness(v);
      }
      loopRef.current = window.setTimeout(loop, kiosk.phase === "liveness" ? 100 : 150);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase, kiosk.tick, kiosk.runLiveness]);



  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6 shadow-xl border-t-4 border-t-suka-orange">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-suka-brown flex items-center justify-center gap-2">
            <Store size={24} className="text-suka-orange" />
            SukaAbsen Kiosk
          </h1>
          <p className="text-sm text-gray-500 font-medium">Outlet: <span className="text-suka-ink">{outletStaff?.outlets?.name || "Loading..."}</span></p>
        </div>

        <div className="relative overflow-hidden rounded-xl border-2 border-gray-100 bg-black min-h-[350px] flex justify-center items-center">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan-faceid {
              0%, 100% { transform: translateY(-50%); opacity: 0; }
              10%, 90% { opacity: 1; }
              50% { transform: translateY(50%); opacity: 1; }
            }
            .animate-scan-faceid {
              animation: scan-faceid 2s ease-in-out infinite;
            }
            @keyframes pulse-glow {
              0%, 100% { box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.4); }
              50% { box-shadow: 0 0 25px 8px rgba(59, 130, 246, 0.8); }
            }
            .face-id-corners {
              background: 
                linear-gradient(to right, currentColor 4px, transparent 4px) 0 0,
                linear-gradient(to bottom, currentColor 4px, transparent 4px) 0 0,
                linear-gradient(to left, currentColor 4px, transparent 4px) 100% 0,
                linear-gradient(to bottom, currentColor 4px, transparent 4px) 100% 0,
                linear-gradient(to right, currentColor 4px, transparent 4px) 0 100%,
                linear-gradient(to top, currentColor 4px, transparent 4px) 0 100%,
                linear-gradient(to left, currentColor 4px, transparent 4px) 100% 100%,
                linear-gradient(to top, currentColor 4px, transparent 4px) 100% 100%;
              background-repeat: no-repeat;
              background-size: 30px 30px;
            }
          `}} />
          <CameraCapture onReady={(v) => (videoRef.current = v)} />
          
          {/* Background Backdrop to darken outside during liveness */}
          {kiosk.phase !== "idle" && kiosk.phase !== "result" && (
            <div className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-500" />
          )}

          {/* Face ID style bracket corners */}
          <div className={`pointer-events-none absolute w-64 h-64 transition-all duration-300 face-id-corners ${
            kiosk.phase === "idle" ? "text-gray-400 opacity-60" :
            kiosk.phase === "result" && !kiosk.result?.ok ? "text-red-500" :
            kiosk.phase === "result" && kiosk.result?.ok ? "text-suka-green" :
            "text-blue-500 rounded-3xl"
          } ${(kiosk.phase === "liveness" || kiosk.phase === "identified") ? "animate-[pulse-glow_2s_infinite]" : ""}`} />
          
          {/* Laser Scanner Line */}
          {kiosk.phase !== "idle" && kiosk.phase !== "result" && (
            <div className="pointer-events-none absolute w-64 h-64 overflow-hidden">
               <div className="absolute top-1/2 left-0 w-full h-[3px] bg-blue-400 animate-scan-faceid shadow-[0_0_15px_5px_rgba(59,130,246,0.6)]" />
            </div>
          )}
        </div>

        <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
          {kiosk.phase === "idle" && (
            <p className="flex items-center gap-2 text-gray-500"><UserRound size={18} /> Menghadap kamera…</p>
          )}
          {kiosk.phase === "checking" && (
            <>
              <p className="text-lg font-medium text-suka-ink">Halo, {kiosk.who?.name}</p>
              <p className="flex items-center gap-2 text-gray-500 text-sm"><Spinner size={14} /> Mengecek data absensi...</p>
            </>
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
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Hadapkan wajah ke kamera. Sistem mengenali otomatis lalu meminta satu gerakan.
      </p>
    </div>
  );
}
