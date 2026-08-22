"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button, Card, Spinner } from "@suka/design-system";
import { Camera, ShieldCheck, CheckCircle2, UserRound, ArrowRight, AlertTriangle, Search, X, RefreshCw, Sparkles, UserCheck, ShieldAlert } from "lucide-react";
import { useToast } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { PageHeader } from "@/components/PageHeader";
import { loadFaceModels, getHuman } from "@/lib/face/recognizer";
import { averageDescriptors } from "@/lib/face/match";
import { OutletSwitcher } from "@/components/OutletSwitcher";
import { splitByEnrollment } from "@/lib/enroll/splitByEnrollment";
import { useRealtimeChannel } from "@suka/realtime";

type Staff = { id: string; name: string; role: string; enrolled_at: string | null };
type EnrollPhase = "list" | "consent" | "center" | "left" | "right" | "saving" | "done";

const ENROLLMENT_ROLES = ["admin", "admin_hr", "owner", "spv", "leader", "regional_manager", "area_manager"];

export default function EnrollPage() {
  const { outletStaff } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [targetStaff, setTargetStaff] = useState<Staff | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"unenrolled" | "enrolled" | "all">("unenrolled");
  
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shots, setShots] = useState<number[][]>([]);
  const shotsRef = useRef<number[][]>([]);
  
  const [consent, setConsent] = useState(false);
  const [isReEnroll, setIsReEnroll] = useState(false);
  const [reEnrollReason, setReEnrollReason] = useState("");
  const [phase, setPhase] = useState<EnrollPhase>("list");
  const phaseRef = useRef<EnrollPhase>("list");
  const busyRef = useRef(false);
  const loopRef = useRef<number | null>(null);

  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const isEnrollmentAllowed = ENROLLMENT_ROLES.includes(outletStaff?.role || "");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  const loadStaff = useCallback(() => {
    if (!selectedOutletId) return;
    setLoadingStaff(true);

    let primaryQuery = supabase
      .from("outlet_staff")
      .select("id, name, role, enrolled_at, status")
      .eq("status", "active")
      .neq("role", "kiosk")
      .neq("role", "mitra");

    if (outletStaff?.role === "spv" || outletStaff?.role === "regional_manager" || outletStaff?.role === "area_manager") {
      primaryQuery = primaryQuery.or(`outlet_id.eq.${selectedOutletId},id.eq.${outletStaff.id}`);
    } else {
      primaryQuery = primaryQuery.eq("outlet_id", selectedOutletId);
    }

    Promise.all([
      primaryQuery,
      supabase
        .from("staff_outlets")
        .select("staff_id, outlet_staff!inner(id, name, role, status, enrolled_at)")
        .eq("outlet_id", selectedOutletId)
    ])
      .then(([primaryRes, assignedRes]) => {
        const staffMap = new Map<string, Staff>();
        (primaryRes.data || []).forEach((s) => {
          if (outletStaff?.id === s.id) {
            staffMap.set(s.id, { ...s, name: `${s.name} (Anda)` } as Staff);
          } else {
            staffMap.set(s.id, s as Staff);
          }
        });
        (assignedRes.data || []).forEach((row: any) => {
          const st = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff;
          if (st && st.status === "active" && st.role !== "kiosk" && st.role !== "mitra" && !staffMap.has(st.id)) {
            if (outletStaff?.id === st.id) {
              staffMap.set(st.id, { id: st.id, name: `${st.name} (Anda)`, role: st.role, enrolled_at: st.enrolled_at });
            } else {
              staffMap.set(st.id, { id: st.id, name: st.name, role: st.role, enrolled_at: st.enrolled_at });
            }
          }
        });
        const combinedList = Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setStaffList(combinedList);
        setLoadingStaff(false);
      })
      .catch((error) => {
        toast.show("err", `Gagal memuat data staff: ${error.message}`);
        setLoadingStaff(false);
      });
  }, [selectedOutletId, supabase, toast, outletStaff]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useRealtimeChannel({
    channelName: `absensi-staff-${selectedOutletId || "none"}`,
    enabled: !!selectedOutletId,
    subs: [
      {
        table: "outlet_staff",
        filter: `outlet_id=eq.${selectedOutletId}`,
        handler: () => { loadStaff(); },
      },
    ],
  });

  useEffect(() => {
    loadFaceModels().catch((err) => setModelError(err.message || "Gagal memuat AI wajah"));
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { shotsRef.current = shots; }, [shots]);
  useEffect(() => { videoRef.current = video; }, [video]);

  useEffect(() => {
    if (phase === "list" || phase === "consent" || phase === "saving" || phase === "done") {
      if (loopRef.current) clearTimeout(loopRef.current);
      return;
    }

    async function loop() {
      if (busyRef.current || !video || video.readyState < 2) {
        loopRef.current = window.setTimeout(loop, 100);
        return;
      }
      
      busyRef.current = true;
      try {
        const human = await getHuman();
        const res = await human.detect(video);

        if (res.face && res.face.length > 0 && res.face[0].embedding) {
          const gList = res.gesture.map(g => g.gesture);
          const currentPhase = phaseRef.current;

          const facingLeft = gList.includes("facing left");
          const facingRight = gList.includes("facing right");
          const isFrontal = !facingLeft && !facingRight;
          const shouldCapture =
            (currentPhase === "center" || currentPhase === "left" || currentPhase === "right") && isFrontal;

          if (shouldCapture) {
            const newShots = [...shotsRef.current, Array.from(res.face[0].embedding)];
            setShots(newShots);
            
            if (currentPhase === "center") {
              setPhase("left");
              phaseRef.current = "left";
            } else if (currentPhase === "left") {
              setPhase("right");
              phaseRef.current = "right";
            } else if (currentPhase === "right") {
              phaseRef.current = "saving";
              setPhase("saving");
              await saveAuto(newShots, videoRef.current);
            }
            
            await new Promise(r => setTimeout(r, 800));
          }
        }
      } catch (err: any) {
         setModelError(err.message || "Deteksi wajah gagal");
      } finally {
        busyRef.current = false;
        if (phaseRef.current === "center" || phaseRef.current === "left" || phaseRef.current === "right") {
          loopRef.current = window.setTimeout(loop, 150);
        }
      }
    }

    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [phase, video]);

  async function saveAuto(finalShots: number[][], currentVideo: HTMLVideoElement | null = videoRef.current) {
    if (!targetStaff || finalShots.length !== 3 || !outletStaff || !currentVideo) return;
    try {
      const descriptor = averageDescriptors(finalShots);
      const { dataUrl } = captureFrame(currentVideo);
      const refPath = `${selectedOutletId}/${targetStaff.id}.jpg`;
      const blob = await (await fetch(dataUrl)).blob();

      const { error: storageError } = await supabase.storage
        .from("face-refs")
        .upload(refPath, blob, { upsert: true, contentType: "image/jpeg" });
      if (storageError) throw new Error(`Upload foto gagal: ${storageError.message}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesi login tidak ditemukan, coba login ulang.");

      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetStaffId: targetStaff.id,
          descriptor,
          refPhotoPath: refPath,
          consentAt: new Date().toISOString(),
          isReEnroll,
          reEnrollReason: reEnrollReason.trim() || null,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.detail || result.reason || "Gagal menyimpan ke server");
      }

      setStaffList(prev => prev.map(s =>
        s.id === targetStaff.id ? { ...s, enrolled_at: new Date().toISOString() } : s
      ));
      setPhase("done");
      toast.show("ok", "Enrollment Wajah Berhasil Tersimpan!");
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e.message}`);
      setPhase("consent");
      setShots([]);
    }
  }

  function handleSelectCrew(s: Staff) {
    setTargetStaff(s);
    setConsent(false);
    setIsReEnroll(false);
    setCameraError(null);
    setVideo(null);
    setPhase("consent");
  }

  function handleReEnroll(s: Staff) {
    setTargetStaff(s);
    setConsent(false);
    setIsReEnroll(true);
    setReEnrollReason("");
    setCameraError(null);
    setVideo(null);
    setPhase("consent");
  }

  function startEnroll() {
    setShots([]);
    shotsRef.current = [];
    setPhase("center");
    phaseRef.current = "center";
  }

  function handleCancel() {
    setTargetStaff(null);
    setConsent(false);
    setIsReEnroll(false);
    setReEnrollReason("");
    setShots([]);
    shotsRef.current = [];
    setVideo(null);
    videoRef.current = null;
    setCameraError(null);
    setPhase("list");
    phaseRef.current = "list";
  }

  function resetToNext() {
    const next = staffList.find((s) => !s.enrolled_at && s.id !== targetStaff?.id);
    if (next) {
      setTargetStaff(next);
      setConsent(false);
      setIsReEnroll(false);
      setReEnrollReason("");
      setShots([]);
      shotsRef.current = [];
      setPhase("consent");
    } else {
      handleCancel();
    }
  }

  if (!isEnrollmentAllowed) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl p-8 border border-amber-200/80 shadow-xl shadow-amber-500/5 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-200">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Akses Pendaftaran Dibatasi</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Fitur pendaftaran biometrik wajah kru hanya dapat dilakukan oleh <strong>Leader, SPV, Area Manager, Regional Manager, Admin HR, dan Admin</strong>.
            </p>
          </div>
          <div className="pt-2">
            <Button onClick={() => window.history.back()} className="px-6 py-2.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800">
              Kembali ke Menu Utama
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { unenrolled, enrolled } = splitByEnrollment(staffList);

  const filteredUnenrolled = unenrolled.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEnrolled = enrolled.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "leader":
      case "spv":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "admin_hr":
      case "regional_manager":
      case "area_manager":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "admin":
      case "owner":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-950 via-slate-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-orange-950/10">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Sparkles size={12} />
            Biometric Management
          </div>
          <h1 className="text-2xl font-black tracking-tight">Enrollment Wajah Crew</h1>
          <p className="text-xs sm:text-sm text-slate-300">Daftarkan dan kalibrasi referensi biometrik wajah kru resmi Suka Shawarma</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 bg-white/10 backdrop-blur px-3.5 py-2 rounded-2xl border border-white/15">
          <ShieldCheck size={18} className="text-emerald-400" />
          <div className="text-xs">
            <span className="text-slate-300 block text-[10px] leading-tight">Otoritas Aktif</span>
            <span className="font-bold text-white capitalize">{outletStaff?.role?.replace("_", " ") || "Staff"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1">
          <OutletSwitcher 
            currentOutletId={selectedOutletId} 
            onChange={(id) => {
              setSelectedOutletId(id);
              setPhase("list");
              setTargetStaff(null);
            }} 
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={loadStaff} 
            disabled={loadingStaff}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200/80 shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingStaff ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {modelError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-start gap-3 shadow-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-bold">Status Engine AI Biometrik</p>
            <p className="text-xs text-red-600 mt-0.5">{modelError}</p>
          </div>
        </div>
      )}

      {phase === "list" && (
        <div className="space-y-4">
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kru berdasarkan nama atau peran (misal: kasir, crew, leader)..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab("unenrolled")}
                className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "unenrolled"
                    ? "bg-white text-orange-600 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Belum Terdaftar</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "unenrolled" ? "bg-orange-100 text-orange-700 font-black" : "bg-slate-200 text-slate-600"
                }`}>
                  {unenrolled.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("enrolled")}
                className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "enrolled"
                    ? "bg-white text-emerald-600 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Sudah Terdaftar</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "enrolled" ? "bg-emerald-100 text-emerald-700 font-black" : "bg-slate-200 text-slate-600"
                }`}>
                  {enrolled.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("all")}
                className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Semua Crew</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600">
                  {staffList.length}
                </span>
              </button>
            </div>
          </div>

          {loadingStaff ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
              <Spinner className="w-8 h-8 text-orange-500" />
              <p className="text-xs font-semibold text-slate-500">Memuat data kru outlet...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="bg-white p-10 text-center space-y-4 rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
              <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-100">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Semua Kru Sudah Terdaftar!</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  Semua kru aktif pada outlet ini telah memiliki referensi biometrik wajah. Jika ada kru baru, pastikan Admin HR mendaftarkannya terlebih dahulu di sistem HR.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(activeTab === "unenrolled" || activeTab === "all") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Kru Belum Terdaftar ({filteredUnenrolled.length})
                    </h4>
                  </div>

                  {filteredUnenrolled.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                      {searchQuery ? "Tidak ditemukan kru yang cocok dengan pencarian." : "Tidak ada kru yang belum terdaftar."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {filteredUnenrolled.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectCrew(s)}
                          className="bg-white p-4 rounded-2xl border-2 border-slate-200/80 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/5 transition-all cursor-pointer flex items-center gap-3.5 group relative overflow-hidden"
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                            {s.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 truncate group-hover:text-orange-600 transition-colors text-sm">
                              {s.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${roleBadgeColor(s.role)}`}>
                                {s.role.replace("_", " ")}
                              </span>
                              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                                Belum Terdaftar
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(activeTab === "enrolled" || activeTab === "all") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={14} />
                      Kru Sudah Terdaftar ({filteredEnrolled.length})
                    </h4>
                  </div>

                  {filteredEnrolled.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                      {searchQuery ? "Tidak ditemukan kru yang cocok dengan pencarian." : "Belum ada kru yang terdaftar di outlet ini."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {filteredEnrolled.map((s) => (
                        <div
                          key={s.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 hover:border-slate-300 transition-all shadow-sm"
                        >
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center font-black text-lg shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 truncate text-sm">{s.name}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${roleBadgeColor(s.role)}`}>
                                {s.role.replace("_", " ")}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <CheckCircle2 size={10} />
                                Aktif
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleReEnroll(s)}
                            className="shrink-0 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
                          >
                            Enroll Ulang
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "consent" && targetStaff && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-xl text-slate-900">Konfirmasi Perekaman Biometrik</h3>
              <p className="text-xs text-slate-500 mt-0.5">Langkah 1 dari 2: Verifikasi Identitas & Persetujuan Legal</p>
            </div>
            <button 
              onClick={handleCancel} 
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Kembali
            </button>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-slate-50 to-orange-50/40 rounded-2xl border border-orange-200/60">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-orange-500/20">
              {targetStaff.name.charAt(0)}
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest">Kandidat Terpilih</span>
              <h4 className="font-black text-slate-900 text-lg leading-tight">{targetStaff.name}</h4>
              <div className="flex items-center gap-2 pt-0.5">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${roleBadgeColor(targetStaff.role)}`}>
                  {targetStaff.role.replace("_", " ")}
                </span>
                <span className="text-xs text-slate-500">ID: {targetStaff.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {isReEnroll && (
            <div className="space-y-2 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
              <div className="text-xs text-amber-800 font-bold flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span>Peringatan Enroll Ulang: Data biometrik lama {targetStaff.name} akan ditimpa dan diganti dengan citra baru.</span>
              </div>
              <div className="pt-2">
                <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                  Alasan Pendaftaran Ulang (Opsional)
                </label>
                <input
                  type="text"
                  value={reEnrollReason}
                  onChange={(e) => setReEnrollReason(e.target.value)}
                  placeholder="Misal: Penampilan rambut/kacamata baru, kamera kiosk sering gagal cocok"
                  className="w-full bg-white border border-amber-300/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <ShieldCheck size={16} className="text-emerald-600" />
              Kepatuhan Privasi Data Pribadi (UU PDP No. 27/2022)
            </label>
            <label className={`flex items-start gap-3.5 p-4 border-2 rounded-2xl cursor-pointer transition-all ${
              consent 
                ? 'border-emerald-500 bg-emerald-50/40 shadow-sm' 
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 accent-emerald-600 shrink-0 rounded cursor-pointer"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900 font-bold">Pernyataan Persetujuan Kru: </strong>
                Saya menyatakan bahwa kru yang bersangkutan telah memberikan izin secara sadar untuk perekaman dan pemrosesan vektor fitur wajah digital semata-mata untuk verifikasi kehadiran absensi internal Suka Shawarma.
              </span>
            </label>
          </div>

          <div className="pt-2">
            <button 
              onClick={startEnroll} 
              disabled={!consent}
              className="w-full py-4 text-base font-black rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/25 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Buka Kamera & Mulai Perekaman Biometrik
            </button>
          </div>
        </div>
      )}

      {(phase === "center" || phase === "left" || phase === "right" || phase === "saving" || phase === "done") && targetStaff && (
        <div className="bg-slate-950 overflow-hidden rounded-3xl border-2 border-orange-500/30 shadow-2xl animate-in fade-in zoom-in-95 text-white">
          <div className="p-4 bg-slate-900/90 backdrop-blur border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold text-sm">
                {targetStaff.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">Perekaman: {targetStaff.name}</h2>
                <p className="text-[10px] text-slate-400">Sistem mengambil 3 sampel posisi frontal otomatis</p>
              </div>
            </div>
            {phase !== "saving" && phase !== "done" && (
              <button 
                onClick={() => setPhase("consent")} 
                className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors"
              >
                Batal
              </button>
            )}
          </div>

          <div className="relative bg-black min-h-[440px] flex items-center justify-center overflow-hidden">
            {cameraError || modelError ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 text-center space-y-3">
                <AlertTriangle size={48} className="text-red-400" />
                <h2 className="text-lg font-bold text-red-400">Gagal Mengakses Kamera / AI</h2>
                <p className="text-slate-300 text-xs max-w-xs">{cameraError || modelError}</p>
                <Button onClick={() => setPhase("consent")} className="mt-2 bg-white text-slate-900 font-bold">
                  Kembali ke Konfirmasi
                </Button>
              </div>
            ) : phase !== "done" && (
              <CameraCapture 
                onReady={setVideo} 
                onError={(e) => setCameraError(e)} 
              />
            )}
            
            {phase !== "done" && (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-dashed border-orange-500/40 animate-pulse flex items-center justify-center relative">
                  <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full border border-orange-400/60 flex items-center justify-center">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-orange-400 absolute top-4 left-4" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-orange-400 absolute top-4 right-4" />
                    <div className="w-4 h-4 border-b-2 border-l-2 border-orange-400 absolute bottom-4 left-4" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-orange-400 absolute bottom-4 right-4" />
                  </div>
                </div>
              </div>
            )}

            {phase !== "done" && (
              <div className="absolute inset-x-0 top-6 flex justify-center z-20 px-4">
                <div className="bg-slate-900/90 backdrop-blur-md border border-orange-500/40 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-white font-black text-sm tracking-wide animate-bounce">
                  {phase === "center" && <><UserRound size={18} className="text-orange-400" /> Tatap Lurus ke Kamera (1/3)</>}
                  {phase === "left" && <><UserRound size={18} className="text-orange-400" /> Pertahankan Tatapan (2/3)</>}
                  {phase === "right" && <><UserRound size={18} className="text-orange-400" /> Tahan Sebentar (3/3)</>}
                  {phase === "saving" && <><Spinner className="w-4 h-4 text-emerald-400" /> Mengenkripsi & Menyimpan Vektor Biometrik...</>}
                </div>
              </div>
            )}

            {phase !== "done" && phase !== "saving" && (
              <div className="absolute bottom-6 flex items-center gap-3 z-20 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full border border-white/10">
                <div className={`w-3.5 h-3.5 rounded-full transition-all ${shots.length >= 1 ? 'bg-emerald-500 scale-110 shadow-[0_0_12px_#10b981]' : 'bg-slate-700'}`} />
                <div className={`w-3.5 h-3.5 rounded-full transition-all ${shots.length >= 2 ? 'bg-emerald-500 scale-110 shadow-[0_0_12px_#10b981]' : 'bg-slate-700'}`} />
                <div className={`w-3.5 h-3.5 rounded-full transition-all ${shots.length >= 3 ? 'bg-emerald-500 scale-110 shadow-[0_0_12px_#10b981]' : 'bg-slate-700'}`} />
              </div>
            )}

            {phase === "done" && (
              <div className="absolute inset-0 bg-white text-slate-900 flex flex-col items-center justify-center p-8 text-center z-30 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center border border-emerald-200 shadow-xl shadow-emerald-500/10">
                  <CheckCircle2 size={48} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900">Enrollment Berhasil!</h2>
                  <p className="text-slate-600 text-xs sm:text-sm max-w-sm mx-auto">
                    Data biometrik wajah <span className="font-bold text-slate-900">{targetStaff.name}</span> telah terdaftar secara resmi. Kru sudah dapat melakukan absensi di Kiosk Outlet maupun Android SuperApp.
                  </p>
                </div>
                
                <div className="flex flex-col w-full max-w-xs gap-2.5 pt-2">
                  {unenrolled.length > 0 ? (
                    <>
                      <button 
                        onClick={resetToNext} 
                        className="w-full py-3.5 font-bold text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg shadow-orange-600/20 transition-all"
                      >
                        Lanjut Enroll Crew Berikutnya
                      </button>
                      <button 
                        onClick={handleCancel} 
                        className="w-full py-3 font-semibold text-xs text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
                      >
                        Kembali ke Daftar Crew
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={handleCancel} 
                      className="w-full py-3.5 font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-lg transition-all"
                    >
                      Selesai (Semua Crew Terdaftar)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
