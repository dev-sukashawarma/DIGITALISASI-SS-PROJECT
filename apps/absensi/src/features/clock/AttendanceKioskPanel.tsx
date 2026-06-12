"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX, Clock, CheckCircle2, Camera, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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

export function AttendanceKioskPanel() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isOutletOpen, setIsOutletOpen] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);

  // Kiosk Integration
  const kiosk = useClockKiosk(outletStaff?.outlet_id || "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => { loadFaceModels().then(() => setModelsReady(true)); }, []);
  useEffect(() => {
    if (outletStaff?.outlet_id) {
      kiosk.loadCandidates();
      kiosk.flushQueue();
      loadRecords();
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
      loopRef.current = window.setTimeout(loop, kiosk.phase === "liveness" ? 40 : 150);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase, kiosk.tick, kiosk.runLiveness, isOutletOpen, modelsReady]);

  if (!outletStaff) return <div className="p-8 flex justify-center"><Spinner /></div>;

  const today = dayjs().format("YYYY-MM-DD");
  const todayRecords = records.filter(r => r.ts_server.startsWith(today));
  const hasIn = todayRecords.some(r => r.type === "in");
  const hasOut = todayRecords.some(r => r.type === "out");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-suka-ink leading-tight">Halo, {outletStaff.name}!</h1>
            <p className="mt-0.5 text-sm text-gray-500">Siap untuk shift hari ini?</p>
          </div>
          {!kiosk.isOnline && (
            <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700">
              Offline · {kiosk.pending} sync
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Camera (Absen) */}
        <div>
          <Card className="relative overflow-hidden p-0 h-full rounded-2xl flex flex-col justify-between">
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
                0%, 100% { box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.3); }
                50% { box-shadow: 0 0 25px 8px rgba(59, 130, 246, 0.6); }
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
               <Camera className="text-suka-brown" size={18} />
               <h2 className="font-bold text-suka-ink">Absen Wajah</h2>
            </div>
            <div className="relative flex justify-center items-center min-h-[300px] bg-black overflow-hidden">
              {!isOutletOpen ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900 text-white p-6 backdrop-blur-sm">
                  <div className="p-5 bg-red-500/20 rounded-full mb-4">
                    <Lock size={48} className="text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-center">Outlet Ditutup</h2>
                  <p className="text-gray-400 text-center mt-2 px-4">
                    Absensi terkunci. Menunggu SPV untuk membuka outlet hari ini.
                  </p>
                </div>
              ) : (
                <CameraCapture onReady={(v) => (videoRef.current = v)} />
              )}

              {/* Background Backdrop to darken outside during liveness */}
              {kiosk.phase !== "idle" && (
                <div className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-500" />
              )}

              {/* Face ID style bracket corners */}
              <div className={`pointer-events-none absolute w-64 h-64 transition-all duration-300 face-id-corners ${
                kiosk.phase === "idle" ? "text-gray-400 opacity-60" :
                kiosk.phase === "result" && !kiosk.result?.ok ? "text-red-500 scale-105 opacity-0" :
                kiosk.phase === "result" && kiosk.result?.ok ? "text-blue-500 scale-105 opacity-0" :
                "text-blue-500"
              } ${(kiosk.phase === "liveness" || kiosk.phase === "identified") ? "animate-[pulse-glow_2s_infinite]" : ""}`} />

              {/* Laser Scanner Line */}
              {kiosk.phase !== "idle" && kiosk.phase !== "result" && (
                <div className="pointer-events-none absolute w-64 h-64 overflow-hidden">
                   <div className="absolute left-0 w-full animate-scan-faceid flex flex-col items-center">
                      <div className="w-full h-[12px] bg-gradient-to-t from-blue-400/30 to-transparent" />
                      <div className="w-full h-[3px] bg-blue-400 rounded-full shadow-[0_0_20px_5px_rgba(59,130,246,0.8)]" />
                      <div className="w-full h-[12px] bg-gradient-to-b from-blue-400/30 to-transparent" />
                   </div>
                </div>
              )}

              {/* Success / Error Full Overlay */}
              {kiosk.phase === "result" && kiosk.result && (
                <div className="absolute inset-0 flex items-center justify-center z-10 transition-all duration-300">
                  <div className={`flex flex-col items-center justify-center p-6 ${
                    kiosk.result.ok ? "text-blue-500" : "text-red-500 animate-success-pop"
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

            <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
              {kiosk.phase === "idle" && !modelsReady && (
                <p className="flex items-center gap-2 text-gray-500"><Spinner size={18} /> Memuat model wajah…</p>
              )}
              {kiosk.phase === "idle" && modelsReady && (
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
                <p className={`flex items-center gap-2 text-lg font-medium ${kiosk.result.ok ? "text-blue-500" : "text-red-600"}`}>
                  {kiosk.result.ok ? <CircleCheck size={22} /> : <CircleX size={22} />} {kiosk.result.message}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Status & History */}
        <div className="space-y-6">
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-500">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status Hari Ini</p>
                <h3 className="text-xl font-bold text-suka-ink mt-1">
                  {loadingHistory ? "Memuat..." : hasIn && hasOut ? "Selesai Shift" : hasIn ? "Sedang Bekerja" : "Belum Absen"}
                </h3>
                <p className="text-xs text-gray-400 mt-1">{dayjs().format("dddd, D MMMM YYYY")}</p>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden rounded-2xl">
            <div className="p-4 border-b border-suka-gray-200 bg-suka-gray-50/60">
              <h2 className="font-bold text-suka-ink flex items-center gap-2">
                <Clock size={18} className="text-suka-brown" /> Riwayat Absensi Terakhir
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 flex justify-center"><Spinner /></div>
              ) : records.map(r => (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-suka-ink flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${r.type === 'in' ? 'bg-suka-green' : 'bg-red-500'}`} />
                      {r.type === 'in' ? 'Masuk' : 'Keluar'}
                    </p>
                    <p className="text-sm text-gray-500">{dayjs(r.ts_server).format("dddd, D MMM YYYY")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-suka-brown">{dayjs(r.ts_server).format("HH:mm")}</p>
                    <p className="text-xs text-gray-400 capitalize">{r.status}</p>
                  </div>
                </div>
              ))}
              {!loadingHistory && records.length === 0 && (
                <div className="p-8 text-center text-gray-500">Belum ada riwayat absensi.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Alat testing — dilipat agar tidak membingungkan pemakaian sehari-hari */}
      <details className="group rounded-2xl border border-suka-gray-200 bg-white">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 [&::-webkit-details-marker]:hidden">
          Alat testing (developer)
          <span className="ml-auto text-gray-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-suka-gray-200 px-4 py-4">
          <p className="mb-3 text-xs text-red-600">Hanya untuk keperluan testing.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={handleResetLog} className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
              Reset Log Absensi Saya
            </button>
            <button onClick={handleUnenroll} className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
              Hapus Data Wajah (Un-enroll)
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
