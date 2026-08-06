"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, Spinner } from "@suka/design-system";
import { Eye, CircleCheck, CircleX, Clock, CheckCircle2, Camera, Lock, Timer, MapPin, Store } from "lucide-react";
import { useAuth } from '@suka/auth';
import { createClient } from "@/lib/supabase";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { CameraCapture } from "@/components/CameraCapture";
import { PermissionModal } from "@/components/PermissionModal";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useClockKiosk } from "@/features/clock/useClockKiosk";
import { triggerSuccessFeedback, triggerErrorFeedback } from "@/utils/haptics";
import { formatDistanceMeters, haversineMeters } from "@/lib/gps";

dayjs.locale("id");

type AttendanceRecord = {
  id: string;
  type: string;
  ts_server: string;
  status: string;
  telat_menit?: number | null;
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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isOutletOpen, setIsOutletOpen] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [jamMasuk, setJamMasuk] = useState<string | null>(null);
  const [jamKeluar, setJamKeluar] = useState<string | null>(null);
  const [absenWindowMode, setAbsenWindowMode] = useState<"auto" | "manual">("auto");
  const [nowMinutes, setNowMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [outletName, setOutletName] = useState<string>("");

  type AssignedOutlet = { id: string; name: string; lat: number | null; lng: number | null; distanceM?: number | null };

  // Leader / Multi-outlet Support — Seamless Auto-Detect
  const [assignedOutlets, setAssignedOutlets] = useState<AssignedOutlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [showOutletPickerModal, setShowOutletPickerModal] = useState<boolean>(false);
  const manualSelectionRef = useRef(false);

  const activeOutletId = selectedOutletId || outletStaff?.outlet_id || "";
  const activeOutletObj = assignedOutlets.find((o) => o.id === activeOutletId);
  const activeOutletName = activeOutletObj?.name || outletName || "Outlet Utama";

  // Kiosk Integration — MODE 1:1: panel pribadi, kunci ke akun yang login.
  const supabase = createClient();
  const kiosk = useClockKiosk(activeOutletId, { lockToStaffId: outletStaff?.id });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);
  const router = useRouter();

  // Load daftar outlet yang diampu / dibawahi oleh staf/leader via /api/staff-outlets
  useEffect(() => {
    if (!outletStaff) return;

    let isMounted = true;
    async function loadAssignedOutlets() {
      let list: AssignedOutlet[] = [];
      try {
        const res = await fetch(`/api/staff-outlets?staff_id=${outletStaff!.id}`);
        const resData = await res.json();
        if (resData.ok && Array.isArray(resData.outlets)) {
          list = resData.outlets;
        }
      } catch (err) {
        console.error("Failed to fetch /api/staff-outlets:", err);
      }

      if (list.length === 0 && outletStaff!.outlet_id) {
        list = [{
          id: outletStaff!.outlet_id,
          name: outletStaff!.outlets?.name || "Outlet Utama",
          lat: null,
          lng: null,
        }];
      }

      if (!isMounted) return;

      setAssignedOutlets(list);
      if (!selectedOutletId && list[0]?.id) {
        setSelectedOutletId(list[0].id);
      }

      // Smart High-Precision Proximity Detection: Otomatis kunci ke outlet terdekat!
      if (typeof navigator !== "undefined" && navigator.geolocation && list.length > 1) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            const deviceLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            let closestOutletId = list[0]?.id;
            let minDistance = Infinity;

            const updatedList = list.map((out) => {
              if (out.lat !== null && out.lng !== null) {
                const dist = haversineMeters({ lat: out.lat, lng: out.lng }, deviceLoc);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestOutletId = out.id;
                }
                return { ...out, distanceM: dist };
              }
              return out;
            });

            // Urutkan outlet dari jarak fisik terdekat
            updatedList.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
            setAssignedOutlets(updatedList);

            // Jika user belum pernah memilih manual, OTOMATIS KUNCI ke outlet terdekat!
            if (!manualSelectionRef.current && closestOutletId) {
              setSelectedOutletId(closestOutletId);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }

    loadAssignedOutlets();
    return () => { isMounted = false; };
  }, [outletStaff]);

  useEffect(() => {
    if (kiosk.result) {
      if (kiosk.result.ok) {
        triggerSuccessFeedback();
        setTimeout(() => {
          router.push("/dashboard/kru-checklist");
        }, 1500);
      } else {
        triggerErrorFeedback();
      }
    }
  }, [kiosk.result, router]);

  useEffect(() => {
    if (!activeOutletId) return;

    // Initial Load for activeOutletId
    kiosk.loadCandidates();
    kiosk.flushQueue();
    loadRecords();

    const fetchConfig = () => {
      Promise.all([
        supabase.from("outlet_attendance_config").select("jam_masuk,jam_keluar,absen_window_mode").eq("outlet_id", activeOutletId).maybeSingle(),
        supabase.from("global_settings").select("value").eq("key", "global_attendance_config").maybeSingle()
      ]).then(([local, global]) => {
        let data = local.data;
        if (!data && global.data?.value) {
          try {
            data = typeof global.data.value === "string" ? JSON.parse(global.data.value) : global.data.value;
          } catch(e) {}
        }
        if (data) {
          setJamMasuk(data.jam_masuk);
          setJamKeluar(data.jam_keluar ?? null);
          setAbsenWindowMode(data.absen_window_mode ?? "auto");
        }
      });
    };
    fetchConfig();

    supabase.from("outlets").select("is_active, name").eq("id", activeOutletId).single()
      .then(({ data }) => {
        if (data) {
          setIsOutletOpen(data.is_active);
          setOutletName(data.name || "");
        }
      });

    // Realtime Subscriptions
    const uniqueChannelName = `kiosk-realtime-${activeOutletId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(uniqueChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outlet_attendance_config', filter: `outlet_id=eq.${activeOutletId}` },
        () => { fetchConfig(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings' },
        () => { fetchConfig(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outlets', filter: `id=eq.${activeOutletId}` },
        (payload) => {
          const newOutlet = payload.new as any;
          if (newOutlet && newOutlet.is_active !== undefined) {
            setIsOutletOpen(newOutlet.is_active);
            if (newOutlet.name) setOutletName(newOutlet.name);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `outlet_id=eq.${activeOutletId}` },
        () => {
          loadRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOutletId]);

  // Otomatis memicu pemindaian lokasi saat phase diset ke "locating" dan izin sudah diberikan
  useEffect(() => {
    if (kiosk.phase === "locating" && kiosk.permissionState === "granted") {
      kiosk.checkLocation();
    }
  }, [kiosk.phase, kiosk.permissionState, kiosk.checkLocation]);

  // Update nowMinutes setiap menit agar window overlay refresh otomatis
  useEffect(() => {
    const tick = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(tick);
  }, []);

  function loadRecords() {
    if (!outletStaff) return;
    setLoadingHistory(true);
    supabase
      .from("attendance")
      .select("id, type, ts_server, status, telat_menit")
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

  // Hitung hasIn di sini (sebelum useEffect) agar bisa dipakai di clockInWindowOpen
  const today = dayjs().format("YYYY-MM-DD");
  const todayRecords = records.filter(r => dayjs(r.ts_server).format("YYYY-MM-DD") === today);
  const hasIn = todayRecords.some(r => r.type === "in");
  const hasOut = todayRecords.some(r => r.type === "out");

  function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

  const isManual = absenWindowMode === "manual";

  // Logika window kamera:
  // - Sudah clock-out → tutup (shift selesai)
  // - Sudah clock-in, belum clock-out → tutup sampai 30 menit sebelum jam_keluar (jika diset)
  // - Belum clock-in → tidak ditutup sebelum buka outlet (diperbolehkan absen masuk kapan saja)
  const clockInWindowOpen = hasOut
    ? false                                                              // shift selesai
    : hasIn
      ? (!jamKeluar || nowMinutes >= toMin(jamKeluar) - 30)             // clock-out window (absen pulang tetap dibatasi)
      : isManual
        ? isOutletOpen                                                  // manual clock-in window
        : true;                                                         // auto clock-in window (selalu terbuka untuk absen masuk)

  // Label jam kamera akan buka lagi (untuk overlay "sedang bekerja")
  const clockOutWindowLabel = jamKeluar
    ? dayjs().startOf("day").add(toMin(jamKeluar) - 30, "minute").format("HH:mm")
    : null;
  // Label jam kamera buka untuk clock-in
  const windowOpenLabel = (!isManual && jamMasuk)
    ? dayjs().startOf("day").add(toMin(jamMasuk) - 60, "minute").format("HH:mm")
    : null;

  useEffect(() => { 
    if (clockInWindowOpen) {
      loadFaceModels()
        .then(() => setModelsReady(true))
        .catch((err) => setModelError(err.message || "Gagal memuat AI wajah. Coba refresh."));
    }
  }, [clockInWindowOpen]);

  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      // Jangan jalankan deteksi wajah jika outlet ditutup, model belum siap, atau di luar window absen
      if (v && v.readyState >= 2 && isOutletOpen && modelsReady && clockInWindowOpen) {
        if (kiosk.phase === "idle") kiosk.tick(v);
        else if (kiosk.phase === "liveness") kiosk.runLiveness(v);
      }
      loopRef.current = window.setTimeout(loop, kiosk.phase === "liveness" ? 120 : 1000);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase, kiosk.tick, kiosk.runLiveness, isOutletOpen, modelsReady, clockInWindowOpen]);

  if (!outletStaff) return <div className="p-8 flex justify-center"><Spinner /></div>;

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Permission Onboarding Modal & Mandatory Gate */}
      <PermissionModal
        isOpen={kiosk.permissionState !== "granted"}
        permissionState={kiosk.permissionState}
        onRequestPermissions={kiosk.requestPermissions}
        errorMessage={kiosk.permissionError}
      />

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

      {/* Active outlet banner for multi-outlet users (Seamless Auto-Detect) */}
      {assignedOutlets.length > 1 && (
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 via-amber-50/60 to-white border border-suka-orange/30 p-3.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs font-extrabold text-suka-ink min-w-0">
            <Store size={16} className="text-suka-orange shrink-0" />
            <span className="truncate">
              📍 Terdeteksi: <span className="text-suka-orange font-black">{activeOutletName}</span>
              {activeOutletObj?.distanceM !== undefined && activeOutletObj?.distanceM !== null && (
                <span className="ml-1.5 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-black">
                  {formatDistanceMeters(activeOutletObj.distanceM, true)}
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setShowOutletPickerModal(true)}
            className="text-xs font-extrabold text-suka-brown bg-white border border-suka-orange/40 px-3 py-1.5 rounded-xl hover:bg-orange-100 transition-all shadow-sm shrink-0"
          >
            🔄 Ganti Outlet
          </button>
        </div>
      )}

      {/* Modal Popup Pilih Outlet Manual */}
      {showOutletPickerModal && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md bg-white p-6 rounded-3xl space-y-4 shadow-2xl border-2 border-suka-orange max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Store className="text-suka-orange" size={20} />
                <h3 className="text-base font-extrabold text-suka-ink">Pilih Lokasi Outlet</h3>
              </div>
              <button
                onClick={() => setShowOutletPickerModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 font-medium">
              Pilih lokasi outlet tempat Anda bertugas saat ini untuk mengunci titik koordinat GPS:
            </p>

            <div className="space-y-2.5">
              {assignedOutlets.map((out) => {
                const isSelected = out.id === activeOutletId;
                const isClosest = out.distanceM !== undefined && out.distanceM !== null && out.distanceM <= 300;
                let distText = "";
                if (out.distanceM !== undefined && out.distanceM !== null) {
                  distText = formatDistanceMeters(out.distanceM, true);
                }

                return (
                  <div
                    key={out.id}
                    onClick={() => {
                      manualSelectionRef.current = true;
                      setSelectedOutletId(out.id);
                      setShowOutletPickerModal(false);
                      kiosk.checkLocation();
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? "border-suka-orange bg-orange-50/60 shadow-md ring-2 ring-suka-orange/40"
                        : "border-gray-200 bg-white hover:border-suka-orange/50 hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-suka-ink truncate">
                          📍 {out.name}
                        </span>
                        {out.id === outletStaff.outlet_id && (
                          <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">Utama</span>
                        )}
                      </div>
                      {distText && (
                        <div className="text-[11px] font-semibold mt-1 flex items-center gap-1 text-gray-500">
                          <span>Jarak: <span className={isClosest ? "text-emerald-600 font-extrabold" : "text-gray-600"}>{distText}</span></span>
                          {isClosest && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">📍 Terdekat</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow transition-colors ${
                      isSelected ? "bg-suka-brown text-white" : "bg-suka-orange text-white group-hover:bg-suka-brown"
                    }`}>
                      {isSelected ? "Aktif" : "Pilih →"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

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
        <div className="relative flex justify-center items-center min-h-[320px] sm:min-h-[380px] bg-black overflow-hidden shadow-inner">
          {/* Mode manual: outlet dikunci SPV */}
          {isManual && !isOutletOpen ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm">
              <div className="p-5 bg-red-500/20 rounded-full mb-4">
                <Lock size={48} className="text-red-500 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-center">Outlet Ditutup</h2>
              <p className="text-gray-400 text-center mt-2 px-4 text-sm max-w-xs">
                Absensi terkunci oleh SPV.
              </p>
            </div>
          ) : /* Mode auto: emergency lock SPV */ !isManual && !isOutletOpen ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm">
              <div className="p-5 bg-red-500/20 rounded-full mb-4">
                <Lock size={48} className="text-red-500 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-center">Dikunci SPV</h2>
              <p className="text-gray-400 text-center mt-2 px-4 text-sm max-w-xs">
                Kiosk dikunci paksa oleh SPV. Hubungi SPV jika ada masalah.
              </p>
            </div>
          ) : !isManual && hasOut ? (
            // Auto mode: shift selesai (sudah clock-in + clock-out)
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm text-center">
              <div className="p-5 bg-suka-green/20 rounded-full mb-4">
                <CheckCircle2 size={48} className="text-suka-green" />
              </div>
              <h2 className="text-xl font-bold">Shift Selesai!</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-xs">
                Kamu sudah absen masuk dan pulang hari ini. Sampai jumpa besok!
              </p>
            </div>
          ) : !clockInWindowOpen && hasIn && !hasOut ? (
            // Sudah clock-in, belum waktunya clock-out — kamera tutup sementara
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm text-center">
              <div className="p-5 bg-suka-green/20 rounded-full mb-4">
                <CheckCircle2 size={48} className="text-suka-green" />
              </div>
              <h2 className="text-xl font-bold">Kamu sudah Clock-in hari ini!</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-xs">
                Kamera absen pulang dibuka pukul{" "}
                <span className="font-bold text-suka-green">{clockOutWindowLabel ?? "30 mnt sebelum tutup"}</span>.
              </p>
            </div>
          ) : !clockInWindowOpen ? (
            // Belum waktunya clock-in
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 backdrop-blur-sm text-center">
              <div className="p-5 bg-amber-500/20 rounded-full mb-4">
                <Timer size={48} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold">Belum Waktunya Absen</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-xs">
                Absen masuk dibuka mulai <span className="font-bold text-amber-400">{windowOpenLabel}</span>
                {jamMasuk && <> (1 jam sebelum shift {jamMasuk.slice(0, 5)})</>}.
              </p>
            </div>
          ) : cameraError || modelError ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 text-center">
              <CircleX size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-red-400">Gagal Memuat Kamera/AI</h2>
              <p className="text-gray-300 mt-2 text-sm">{cameraError || modelError}</p>
            </div>
          ) : kiosk.phase === "locating" ? (
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-6 text-center space-y-4 bg-slate-900 text-white">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes ripple {
                  0% { transform: scale(0.8); opacity: 1; border-width: 4px; }
                  100% { transform: scale(3.5); opacity: 0; border-width: 1px; }
                }
                .animate-radar-1 { animation: ripple 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite; }
                .animate-radar-2 { animation: ripple 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 0.6s; }
                .animate-radar-3 { animation: ripple 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 1.2s; }
              `}} />
              <div className="relative flex items-center justify-center w-28 h-28">
                <div className="absolute inset-0 rounded-full border-suka-orange animate-radar-1" style={{ borderStyle: 'solid' }} />
                <div className="absolute inset-0 rounded-full border-suka-orange animate-radar-2" style={{ borderStyle: 'solid' }} />
                <div className="absolute inset-0 rounded-full border-suka-orange animate-radar-3" style={{ borderStyle: 'solid' }} />
                <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-suka-orange to-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)]">
                  <MapPin size={28} className="animate-bounce" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold text-base tracking-wide">Memindai Lokasi Anda...</p>
                <p className="text-gray-400 text-xs">Mendeteksi koordinat GPS outlet</p>
              </div>
            </div>
          ) : kiosk.phase === "location_invalid" ? (
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-6 text-center bg-red-950/95 text-white space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-900/50 text-red-500 border border-red-500/20">
                <CircleX size={36} className="stroke-[2.5]" />
              </div>
              <div className="space-y-2 max-w-xs">
                <h3 className="text-red-400 font-extrabold text-base">Akses Lokasi Ditolak</h3>
                <p className="text-gray-300 text-xs leading-normal">
                  {kiosk.result?.message || "Anda terdeteksi di luar radius outlet."}
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  {kiosk.gpsDistance !== null && (
                    <div className="inline-block bg-slate-900 border border-red-500/30 rounded-lg px-2.5 py-1">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Jarak Saat Ini</p>
                      <p className="text-base font-black text-red-400">{formatDistanceMeters(kiosk.gpsDistance, false)}</p>
                    </div>
                  )}
                  {kiosk.deviceCoords && (
                    <div className="inline-block bg-slate-900 border border-red-500/30 rounded-lg px-2.5 py-1">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Koordinat Anda</p>
                      <p className="text-[11px] font-mono text-red-300">
                        {kiosk.deviceCoords.lat.toFixed(6)}, {kiosk.deviceCoords.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[200px] mt-1">
                <button
                  onClick={() => kiosk.checkLocation()}
                  className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] w-full"
                >
                  Coba Pindai Ulang Lokasi
                </button>
              </div>
            </div>
          ) : kiosk.permissionState === "granted" ? (
            <CameraCapture 
              onReady={(v) => (videoRef.current = v)} 
              onError={(e) => setCameraError(e)}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : null}

          {/* Background Backdrop to darken outside during liveness */}
          {kiosk.phase !== "idle" && (
            <div className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-500" />
          )}

          {/* Face ID style bracket corners */}
          <div className={`pointer-events-none absolute w-48 h-48 sm:w-64 sm:h-64 transition-all duration-300 face-id-corners ${
            kiosk.phase === "idle" ? "text-gray-400 opacity-60" :
            kiosk.phase === "result" && !kiosk.result?.ok ? "text-red-500 scale-105 opacity-0" :
            kiosk.phase === "result" && kiosk.result?.ok ? "text-suka-green scale-105 opacity-0" :
            "text-suka-orange"
          } ${(kiosk.phase === "liveness" || kiosk.phase === "identified") ? "animate-[pulse-glow_2s_infinite]" : ""}`} />

          {/* Laser Scanner Line */}
          {kiosk.phase !== "idle" && kiosk.phase !== "result" && (
            <div className="pointer-events-none absolute w-48 h-48 sm:w-64 sm:h-64 overflow-hidden">
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

        <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
          {kiosk.phase === "idle" && clockInWindowOpen && (
            <div className="text-sm text-gray-600">
              Anda berada di outlet <span className="font-bold text-suka-ink">{outletName || "Loading..."}</span>.<br />
              Halo <span className="font-bold text-suka-ink">{outletStaff.name}</span>, silakan scan wajah Anda.
            </div>
          )}
          {kiosk.phase === "idle" && clockInWindowOpen && !modelsReady && (
            <p className="flex items-center gap-2 text-gray-500 font-medium animate-pulse">
              <Spinner size={18} /> Memuat model wajah…
            </p>
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

      {/* Tombol Manual (Hanya untuk staff tertentu) */}
      {outletStaff?.allow_manual_button && clockInWindowOpen && kiosk.phase !== "result" && kiosk.phase !== "submitting" && (
        <Card className="p-4 rounded-3xl border border-suka-orange shadow-md bg-orange-50">
          <div className="flex flex-col items-center justify-center gap-3">
            <p className="text-sm font-bold text-suka-brown text-center">Kamera bermasalah?</p>
            <button
              onClick={() => kiosk.doSubmitManual(outletStaff.id, outletStaff.name)}
              disabled={kiosk.phase === "locating" || kiosk.permissionState !== "granted"}
              className="w-full py-3 bg-suka-orange text-white font-extrabold rounded-xl shadow hover:bg-suka-brown transition-colors disabled:opacity-50"
            >
              Absen Manual Tanpa Kamera
            </button>
            <p className="text-[10px] font-bold text-suka-orange text-center">
              Perhatian: Lokasi GPS Anda tetap akan divalidasi. Pilihan ini khusus untuk kamera yang bermasalah.
            </p>
          </div>
        </Card>
      )}

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
            const delay = r.telat_menit ?? ((r.status === 'telat' && r.type === 'in' && jamMasuk) ? calculateDelayMinutes(r.ts_server, jamMasuk) : null);
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
    </div>
  );
}
