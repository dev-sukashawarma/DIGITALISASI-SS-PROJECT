"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX, Clock, CheckCircle2, Camera, Lock } from "lucide-react";
import { useAuth } from '@suka/auth';
import { createClient } from "@/lib/supabase";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useClockKiosk } from "@/features/clock/useClockKiosk";

dayjs.locale("id");

type AttendanceRecord = {
  id: string;
  type: string;
  ts_server: string;
  status: string;
};

function calculateDelayMinutes(tsServer: string, jamMasuk: string): number {
  const [h, m] = jamMasuk.split(":").map(Number);
  const serverTime = new Date(tsServer);
  
  const expectedTime = new Date(tsServer);
  expectedTime.setHours(h, m, 0, 0);
  
  const diffMs = serverTime.getTime() - expectedTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export function AttendanceKioskPanel() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isOutletOpen, setIsOutletOpen] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [jamMasuk, setJamMasuk] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  // Kiosk Integration
  const kiosk = useClockKiosk(outletStaff?.outlet_id || "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => { 
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((err) => setModelError(err.message || "Gagal memuat AI wajah. Coba refresh."));
  }, []);
  useEffect(() => {
    if (outletStaff?.outlet_id) {
      kiosk.loadCandidates();
      kiosk.flushQueue();
      loadRecords();
      
      supabase.from("outlet_attendance_config").select("jam_masuk").eq("outlet_id", outletStaff.outlet_id).single()
        .then(({ data }) => {
          if (data) setJamMasuk(data.jam_masuk);
        });
    }
  }, [outletStaff?.outlet_id]);

  // Poll status Buka/Tutup Outlet (is_active)
  useEffect(() => {
    if (!outletStaff?.outlet_id) return;

    async function checkStatus() {
      const { data } = await supabase.from("outlets").select("is_active").eq("id", outletStaff!.outlet_id).single();
      if (data) setIsOutletOpen(data.is_active);
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [outletStaff?.outlet_id]);

  async function handleResetLog() {
    if (!outletStaff) return;
    if (!confirm("Hapus semua riwayat absensi Anda (hanya untuk testing)?")) return;
    try {
      const res = await fetch("/api/debug/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_staff_id: outletStaff.id, action: "reset_log" })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      loadRecords();
      alert("Log absensi berhasil di-reset!");
    } catch (e: any) {
      alert("Gagal mereset log: " + e.message);
    }
  }

  async function handleUnenroll() {
    if (!outletStaff) return;
    if (!confirm("Hapus data wajah Anda (Un-enroll)? Anda harus didaftarkan ulang oleh SPV nanti.")) return;
    try {
      const res = await fetch("/api/debug/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_staff_id: outletStaff.id, action: "unenroll" })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      kiosk.loadCandidates();
      alert("Wajah berhasil di-unenroll!");
    } catch (e: any) {
      alert("Gagal un-enroll: " + e.message);
    }
  }

  function loadRecords() {
    if (!outletStaff) return;
    setLoadingHistory(true);
    supabase
      .from("attendance")
      .select("id, type, ts_server, status")
      .eq("outlet_staff_id", outletStaff.id)
      .order("ts_server", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setRecords(data || []);
        setLoadingHistory(false);
      });
  }

  // Refresh history after a successful clock in/out
  useEffect(() => {
    if (kiosk.phase === "result" && kiosk.result?.ok) {
      loadRecords();
    }
  }, [kiosk.phase, kiosk.result?.ok]);

  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      // Jangan jalankan deteksi wajah jika outlet ditutup atau model belum siap
      if (v && v.readyState >= 2 && isOutletOpen && modelsReady) {
        if (kiosk.phase === "idle") kiosk.tick(v);
        else if (kiosk.phase === "liveness") kiosk.runLiveness(v);
      }
      loopRef.current = window.setTimeout(loop, kiosk.phase === "liveness" ? 40 : 500);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase, kiosk.tick, kiosk.runLiveness, isOutletOpen, modelsReady]);

  if (!outletStaff) return <div className="p-8 flex justify-center"><Spinner /></div>;

  const today = dayjs().format("YYYY-MM-DD");
  const todayRecords = records.filter(r => dayjs(r.ts_server).format("YYYY-MM-DD") === today);
  const hasIn = todayRecords.some(r => r.type === "in");
  const hasOut = todayRecords.some(r => r.type === "out");

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-suka-orange uppercase tracking-wider">SukaAbsen Outlet</p>
          <h1 className="text-xl font-extrabold text-suka-ink truncate">Halo, {outletStaff.name}!</h1>
        </div>
        <div className="shrink-0">
          {!kiosk.isOnline ? (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[9px] font-bold text-amber-700 animate-pulse flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              Offline
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[9px] font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
              Online
            </span>
          )}
        </div>
      </div>

      {/* Camera (Absen) - POSISI ATAS */}
      <Card className={`relative overflow-hidden p-0 rounded-3xl flex flex-col justify-between border transition-all duration-500 shadow-lg ${
        (kiosk.phase === "liveness" || kiosk.phase === "identified")
          ? "border-suka-orange/60 shadow-[0_0_25px_10px_rgba(242,151,68,0.2)]"
          : kiosk.phase === "result" && kiosk.result?.ok
            ? "border-suka-green/50 shadow-[0_0_25px_10px_rgba(10,125,44,0.15)]"
            : kiosk.phase === "result" && !kiosk.result?.ok
              ? "border-red-500/50 shadow-[0_0_25px_10px_rgba(239,68,68,0.15)]"
              : "border-suka-gray-200"
      }`}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scan-faceid {
            0% { top: 5%; opacity: 0; }
            10% { opacity: 1; }
            45% { top: 95%; opacity: 1; }
            50% { top: 95%; opacity: 0; }
            55% { top: 95%; opacity: 0; }
            60% { top: 95%; opacity: 1; }
            95% { top: 5%; opacity: 1; }
            100% { top: 5%; opacity: 0; }
          }
          .animate-scan-faceid {
            animation: scan-faceid 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 10px 2px rgba(242, 151, 68, 0.3); }
            50% { box-shadow: 0 0 25px 8px rgba(242, 151, 68, 0.6); }
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
          @keyframes success-pop {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-success-pop {
            animation: success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
          @keyframes stroke { 100% { stroke-dashoffset: 0; } }
        `}} />
        <div className="p-4 bg-suka-gray-50/60 border-b border-suka-gray-200 flex items-center gap-2">
           <Camera className="text-suka-orange" size={18} />
           <h2 className="font-bold text-suka-ink text-sm sm:text-base">Absen Wajah</h2>
        </div>
        <div className="relative flex justify-center items-center min-h-[320px] bg-black overflow-hidden shadow-inner">
          {!isOutletOpen ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm">
              <div className="p-5 bg-red-500/20 rounded-full mb-4">
                <Lock size={48} className="text-red-500 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-center">Outlet Ditutup</h2>
              <p className="text-gray-400 text-center mt-2 px-4 text-sm max-w-xs">
                Absensi terkunci. Menunggu SPV untuk membuka outlet hari ini.
              </p>
            </div>
          ) : cameraError || modelError ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 text-center">
              <CircleX size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-red-400">Gagal Memuat Kamera/AI</h2>
              <p className="text-gray-300 mt-2 text-sm">{cameraError || modelError}</p>
            </div>
          ) : (
            <CameraCapture 
              onReady={(v) => (videoRef.current = v)} 
              onError={(e) => setCameraError(e)}
            />
          )}

          {/* Background Backdrop to darken outside during liveness */}
          {kiosk.phase !== "idle" && (
            <div className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-500" />
          )}

          {/* Face ID style bracket corners */}
          <div className={`pointer-events-none absolute w-64 h-64 transition-all duration-300 face-id-corners ${
            kiosk.phase === "idle" ? "text-gray-400 opacity-60" :
            kiosk.phase === "result" && !kiosk.result?.ok ? "text-red-500 scale-105 opacity-0" :
            kiosk.phase === "result" && kiosk.result?.ok ? "text-suka-green scale-105 opacity-0" :
            "text-suka-orange"
          } ${(kiosk.phase === "liveness" || kiosk.phase === "identified") ? "animate-[pulse-glow_2s_infinite]" : ""}`} />

          {/* Laser Scanner Line */}
          {kiosk.phase !== "idle" && kiosk.phase !== "result" && (
            <div className="pointer-events-none absolute w-64 h-64 overflow-hidden">
               <div className="absolute left-0 w-full animate-scan-faceid flex flex-col items-center">
                  <div className="w-full h-[12px] bg-gradient-to-t from-suka-orange/30 to-transparent" />
                  <div className="w-full h-[3px] bg-suka-orange rounded-full shadow-[0_0_20px_5px_rgba(242,151,68,0.8)]" />
                  <div className="w-full h-[12px] bg-gradient-to-b from-suka-orange/30 to-transparent" />
               </div>
            </div>
          )}

          {/* Success / Error Full Overlay */}
          {kiosk.phase === "result" && kiosk.result && (
            <div className="absolute inset-0 flex items-center justify-center z-10 transition-all duration-300">
              <div className={`flex flex-col items-center justify-center p-6 ${
                kiosk.result.ok ? "text-suka-green animate-success-pop" : "text-red-500 animate-success-pop"
              }`}>
                <div className="drop-shadow-[0_0_30px_currentColor]">
                  {kiosk.result.ok ? (
                    <svg className="w-32 h-32" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                      <circle className="stroke-current stroke-[2px] fill-none" cx="26" cy="26" r="25" style={{ strokeDasharray: 166, strokeDashoffset: 166, animation: 'stroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) forwards' }} />
                      <path className="stroke-current stroke-[3px] fill-none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style={{ strokeDasharray: 48, strokeDashoffset: 48, animation: 'stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards' }} />
                    </svg>
                  ) : (
                    <CircleX size={100} strokeWidth={1.2} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 text-center min-h-[110px] flex flex-col items-center justify-center gap-3">
          {kiosk.phase === "idle" && !modelsReady && (
            <p className="flex items-center gap-2 text-gray-500 font-medium animate-pulse">
              <Spinner size={18} /> Memuat model wajah…
            </p>
          )}
          {kiosk.phase === "idle" && modelsReady && (
            <div className="flex flex-col items-center gap-1 animate-in fade-in duration-300">
              <UserRound size={28} className="text-gray-300" />
              <p className="text-gray-500 font-semibold text-sm">Menghadap kamera untuk Absen…</p>
            </div>
          )}
          {kiosk.phase === "identified" && (
            <p className="text-xl font-bold text-suka-ink animate-in fade-in slide-in-from-bottom-2 duration-300">
              Halo, {kiosk.who?.name}
            </p>
          )}
          {kiosk.phase === "liveness" && (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
              <p className="text-sm font-medium text-gray-500">
                Halo, <span className="font-bold text-suka-ink">{kiosk.who?.name}</span> · {kiosk.action === "in" ? "Clock-in" : "Clock-out"}
              </p>
              <div className="flex items-center gap-2 rounded-full border-2 border-suka-orange bg-suka-cream px-6 py-2.5 font-bold text-suka-brown shadow-md animate-pulse">
                <Eye size={22} className="text-suka-orange" /> {kiosk.challengeLabel}
              </div>
            </div>
          )}
          {kiosk.phase === "submitting" && (
            <div className="flex flex-col items-center gap-2">
              <Spinner size={24} />
              <p className="text-sm text-gray-500 font-semibold">Mengirim data absensi…</p>
            </div>
          )}
          {kiosk.phase === "result" && kiosk.result && (
            <div className={`flex flex-col items-center justify-center gap-1 p-3 w-full rounded-xl font-bold animate-in fade-in zoom-in-95 duration-500 shadow-sm ${
              kiosk.result.ok 
                ? "bg-suka-green/10 text-suka-green border border-suka-green/20" 
                : "bg-red-50 text-red-600 border border-red-200"
            }`}>
               <div className="flex items-center gap-2 text-lg">
                 {kiosk.result.ok ? <CircleCheck size={22} /> : <CircleX size={22} />} 
                 {kiosk.result.ok ? "Berhasil!" : "Gagal"}
               </div>
               <span className="text-xs font-semibold opacity-90">{kiosk.result.message}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Status Hari Ini - PINDAH DI BAWAH KAMERA */}
      <Card className={`p-5 rounded-3xl border transition-all duration-300 shadow-md ${
        loadingHistory 
          ? "bg-white border-suka-gray-200" 
          : hasIn && hasOut 
            ? "bg-emerald-50/30 border-emerald-100 border-l-4 border-l-suka-green" 
            : hasIn 
              ? "bg-orange-50/30 border-orange-100 border-l-4 border-l-suka-orange" 
              : "bg-amber-50/25 border-amber-100 border-l-4 border-l-amber-500"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl shadow-sm shrink-0 ${
            loadingHistory 
              ? "bg-gray-100 text-gray-400" 
              : hasIn && hasOut 
                ? "bg-suka-green text-white" 
                : hasIn 
                  ? "bg-suka-orange text-white" 
                  : "bg-amber-500 text-white"
          }`}>
            <CheckCircle2 size={22} />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Hari Ini</p>
            <h3 className="text-lg font-extrabold text-suka-ink leading-tight">
              {loadingHistory ? "Memuat..." : hasIn && hasOut ? "Selesai Shift (Masuk & Keluar)" : hasIn ? "Sedang Bekerja" : "Belum Absen"}
            </h3>
            <p className="text-xs text-gray-500 font-semibold capitalize">
              {dayjs().format("dddd, D MMMM YYYY")}
            </p>
          </div>
        </div>
      </Card>

      {/* Riwayat Absensi Terakhir */}
      <Card className="p-0 overflow-hidden rounded-3xl border border-suka-gray-200 shadow-md flex flex-col min-h-[220px]">
        <div className="p-4 border-b border-suka-gray-200 bg-suka-gray-50/60 flex items-center justify-between">
          <h2 className="font-bold text-suka-ink flex items-center gap-2 text-sm sm:text-base">
            <Clock size={18} className="text-suka-orange" /> Riwayat Absensi Terakhir
          </h2>
          {jamMasuk && (
            <span className="text-[10px] bg-suka-cream border border-suka-orange/20 text-suka-brown font-bold px-2.5 py-1 rounded-full">
              Target: {jamMasuk}
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100 overflow-y-auto max-h-[260px]">
          {loadingHistory ? (
            <div className="p-10 flex justify-center"><Spinner /></div>
          ) : records.map(r => {
            const delay = (r.status === 'telat' && r.type === 'in' && jamMasuk) ? calculateDelayMinutes(r.ts_server, jamMasuk) : null;
            const isLate = r.status === 'telat';
            
            return (
              <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-suka-cream/20 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs ${
                    r.type === 'in' 
                      ? 'bg-emerald-50 text-suka-green border border-emerald-100' 
                      : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    {r.type === 'in' ? 'IN' : 'OUT'}
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-suka-ink text-sm">
                      {r.type === 'in' ? 'Absen Masuk' : 'Absen Keluar'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {dayjs(r.ts_server).format("dddd, D MMM YYYY")}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-base font-extrabold text-suka-brown leading-none">
                    {dayjs(r.ts_server).format("HH:mm")}
                  </p>
                  <div className="flex justify-end">
                    {r.type === 'in' ? (
                      isLate ? (
                        <span className="inline-block bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-red-100">
                          Telat {delay ? `${delay}m` : ""}
                        </span>
                      ) : (
                        <span className="inline-block bg-emerald-50 text-suka-green px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-emerald-100">
                          Tepat Waktu
                        </span>
                      )
                    ) : (
                      <span className="inline-block bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-gray-100">
                        Selesai
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!loadingHistory && records.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-xs font-semibold">
              Belum ada riwayat absensi.
            </div>
          )}
        </div>
      </Card>

      {/* Alat testing — dilipat agar tidak membingungkan pemakaian sehari-hari */}
      <details className="group rounded-2xl border border-suka-gray-200 bg-white">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-4 text-sm font-semibold text-gray-500 hover:bg-slate-50 transition-colors [&::-webkit-details-marker]:hidden rounded-2xl">
          Alat testing (developer)
          <span className="ml-auto text-gray-400 transition-transform duration-200 group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-suka-gray-200 px-5 py-5 space-y-4 bg-slate-50/50 rounded-b-2xl">
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
            PERINGATAN: Tombol di bawah hanya untuk keperluan pengujian lokal (developer).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleResetLog} 
              className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all shadow-sm"
            >
              Reset Log Absensi Saya
            </button>
            <button 
              onClick={handleUnenroll} 
              className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-amber-600 hover:bg-amber-50 hover:border-amber-300 active:scale-95 transition-all shadow-sm"
            >
              Hapus Data Wajah (Un-enroll)
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
