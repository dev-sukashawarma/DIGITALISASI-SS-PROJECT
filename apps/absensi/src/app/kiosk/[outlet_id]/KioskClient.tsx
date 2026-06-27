"use client";

import { useEffect, useRef } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX, Store } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useAuth } from '@suka/auth';
import { useClockKiosk } from "@/features/clock/useClockKiosk";

export function KioskClient({ outlet_id }: { outlet_id: string }) {
  const kiosk = useClockKiosk(outlet_id);
  const { outletStaff } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => { loadFaceModels(); }, []);
  useEffect(() => { if (outlet_id) { kiosk.loadCandidates(); kiosk.flushQueue(); } }, [outlet_id]);

  // Otomatis memicu pemindaian lokasi saat phase diset ke "locating"
  useEffect(() => {
    if (kiosk.phase === "locating") {
      kiosk.checkLocation();
    }
  }, [kiosk.phase, kiosk.checkLocation]);

  // Loop deteksi: jalankan tick/liveness sesuai phase.
  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        if (kiosk.phase === "idle") kiosk.tick(v);
        else if (kiosk.phase === "liveness") kiosk.runLiveness(v);
      }
      loopRef.current = window.setTimeout(loop, kiosk.phase === "liveness" ? 100 : 500);
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

        {/* Fase 1: Memindai Lokasi GPS */}
        {kiosk.phase === "locating" && (
          <div className="relative overflow-hidden rounded-xl border-2 border-gray-100 bg-slate-900 min-h-[350px] flex flex-col justify-center items-center p-6 text-center space-y-4 shadow-inner">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes pulse-radar {
                0% { transform: scale(0.8); opacity: 0.8; }
                100% { transform: scale(2.2); opacity: 0; }
              }
              .animate-radar-1 { animation: pulse-radar 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite; }
              .animate-radar-2 { animation: pulse-radar 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 0.6s; }
              .animate-radar-3 { animation: pulse-radar 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 1.2s; }
            `}} />
            <div className="relative flex items-center justify-center w-32 h-32">
              <div className="absolute inset-0 rounded-full bg-suka-orange/20 animate-radar-1" />
              <div className="absolute inset-0 rounded-full bg-suka-orange/20 animate-radar-2" />
              <div className="absolute inset-0 rounded-full bg-suka-orange/20 animate-radar-3" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-suka-orange text-white shadow-lg">
                <Store size={32} className="animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white font-bold text-lg tracking-wide">Memindai Lokasi Anda...</p>
              <p className="text-gray-400 text-xs">Mendeteksi koordinat GPS outlet</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-suka-orange bg-suka-orange/10 px-3 py-1.5 rounded-full border border-suka-orange/20">
              <span className="w-1.5 h-1.5 rounded-full bg-suka-orange animate-ping" />
              GPS Akurasi Tinggi Aktif
            </div>
          </div>
        )}

        {/* Fase 2: Lokasi Diluar Radius */}
        {kiosk.phase === "location_invalid" && (
          <div className="relative overflow-hidden rounded-xl border-2 border-red-100 bg-red-50/50 min-h-[350px] flex flex-col justify-center items-center p-6 text-center space-y-6 animate-fade-in">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 shadow-sm border border-red-200">
              <CircleX size={44} className="stroke-[2.5]" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h3 className="text-red-800 font-extrabold text-xl">Akses Lokasi Ditolak</h3>
              <p className="text-red-700 text-xs font-medium leading-relaxed">
                {kiosk.result?.message || "Anda terdeteksi di luar radius outlet."}
              </p>
              {kiosk.gpsDistance !== null && (
                <div className="inline-block bg-white border border-red-200 rounded-lg px-3 py-1.5 shadow-sm mt-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Jarak Saat Ini</p>
                  <p className="text-lg font-black text-red-600">{kiosk.gpsDistance.toFixed(1)} meter</p>
                </div>
              )}
            </div>
            <button
              onClick={() => kiosk.checkLocation()}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Coba Pindai Ulang Lokasi
            </button>
          </div>
        )}

        {/* Fase 3: Lokasi Valid, Jalankan Deteksi Wajah */}
        {kiosk.phase !== "locating" && kiosk.phase !== "location_invalid" && (
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
        )}

        <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
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
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Hadapkan wajah ke kamera. Sistem mengenali otomatis lalu meminta satu gerakan.
      </p>
    </div>
  );
}
