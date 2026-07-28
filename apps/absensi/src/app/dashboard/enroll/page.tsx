"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button, Card, Spinner } from "@suka/design-system";
import { Camera, ShieldCheck, CheckCircle2, UserRound, ArrowRight, AlertTriangle } from "lucide-react";
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

export default function EnrollPage() {
  const { outletStaff } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [targetStaff, setTargetStaff] = useState<Staff | null>(null);
  
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); // selalu up-to-date untuk saveAuto
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

  // Initialize outlet ID from auth
  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  // Loader stabil untuk daftar staff — dipanggil dari efek awal & dari realtime handler.
  const loadStaff = useCallback(() => {
    if (!selectedOutletId) return;
    setLoadingStaff(true);

    let primaryQuery = supabase
      .from("outlet_staff")
      .select("id, name, role, enrolled_at, status")
      .eq("status", "active")
      .neq("role", "kiosk");

    if (outletStaff?.role === "spv") {
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
          // Tambahkan label "(Anda)" jika ini adalah user SPV yang sedang login
          if (outletStaff?.id === s.id) {
            staffMap.set(s.id, { ...s, name: `${s.name} (Anda)` } as Staff);
          } else {
            staffMap.set(s.id, s as Staff);
          }
        });
        (assignedRes.data || []).forEach((row: any) => {
          const st = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff;
          if (st && st.status === "active" && st.role !== "kiosk" && !staffMap.has(st.id)) {
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

  // Load staff when outlet changes
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Realtime: refresh daftar saat outlet_staff outlet ini berubah (insert/update/delete)
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

  // Pre-load models
  useEffect(() => {
    loadFaceModels().catch((err) => setModelError(err.message || "Gagal memuat AI wajah"));
  }, []);

  // Sync state & ref
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { shotsRef.current = shots; }, [shots]);
  useEffect(() => { videoRef.current = video; }, [video]); // pastikan saveAuto selalu dapat video terbaru

  // Auto capture loop
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

          // FRONTAL-ONLY: ambil 3 frame saat wajah menghadap depan (tidak menoleh).
          // Descriptor frontal-tajam = referensi terbaik untuk absen (kiosk selalu
          // frontal). Merata-rata depan+kiri+kanan dulu menumpulkan referensi → orang
          // beda jadi saling mirip. Jeda 800ms antar-capture memberi variasi frontal sehat.
          const facingLeft = gList.includes("facing left");
          const facingRight = gList.includes("facing right");
          const isFrontal = !facingLeft && !facingRight; // wajah terdeteksi & tidak menoleh
          const shouldCapture =
            (currentPhase === "center" || currentPhase === "left" || currentPhase === "right") && isFrontal;

          if (shouldCapture) {
            const newShots = [...shotsRef.current, Array.from(res.face[0].embedding)];
            setShots(newShots);
            
            if (currentPhase === "center") {
              setPhase("left");
              phaseRef.current = "left"; // sync langsung agar loop tidak re-trigger
            } else if (currentPhase === "left") {
              setPhase("right");
              phaseRef.current = "right";
            } else if (currentPhase === "right") {
              // Langsung set ref ke saving agar loop berhenti sebelum re-render
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

      // Upload foto referensi ke storage — tangkap error secara eksplisit
      const { error: storageError } = await supabase.storage
        .from("face-refs")
        .upload(refPath, blob, { upsert: true, contentType: "image/jpeg" });
      if (storageError) throw new Error(`Upload foto gagal: ${storageError.message}`);

      // Update DB via server-side API route (service_role) — bypass RLS sepenuhnya.
      // Kirim JWT token di header agar server bisa verifikasi identity user
      // (server-side tidak bisa akses localStorage browser).
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

      // Tandai staff sebagai terdaftar (pindah ke section "Sudah Terdaftar")
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
    setCameraError(null); // reset error kamera dari sesi sebelumnya
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
    shotsRef.current = []; // sync ref langsung agar loop baca data baru
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
    setVideo(null);       // bersihkan referensi video lama
    videoRef.current = null;
    setCameraError(null); // bersihkan error kamera
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
      setPhase("consent");
    } else {
      handleCancel();
    }
  }

  const { unenrolled, enrolled } = splitByEnrollment(staffList);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">
      <PageHeader
        icon={<Camera size={20} />}
        title="Enrollment Crew"
        subtitle="Daftarkan data biometrik wajah crew yang baru bergabung"
      />

      <OutletSwitcher 
        currentOutletId={selectedOutletId} 
        onChange={(id) => {
          setSelectedOutletId(id);
          setPhase("list");
          setTargetStaff(null);
        }} 
      />

      {modelError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold flex items-start gap-2 mb-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          Peringatan AI: {modelError}
        </div>
      )}

      {phase === "list" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-suka-ink mb-2">Pilih Crew Belum Terdaftar</h3>
          
          {loadingStaff ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : staffList.length === 0 ? (
            <Card className="p-8 text-center space-y-4 border-dashed border-2">
              <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-suka-ink">Semua Selesai!</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  Semua crew di outlet ini sudah menyelesaikan enrollment wajah. Jika Anda butuh menambah crew baru, silakan minta Admin HR untuk mendaftarkannya terlebih dahulu.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Section: Belum Terdaftar */}
              {unenrolled.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Belum Terdaftar ({unenrolled.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {unenrolled.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectCrew(s)}
                        className="bg-white p-4 rounded-2xl border-2 border-gray-200 hover:border-suka-orange hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
                      >
                        <div className="w-12 h-12 bg-suka-cream rounded-full flex items-center justify-center text-suka-brown font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-suka-ink truncate group-hover:text-suka-orange transition-colors">{s.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{s.role}</p>
                        </div>
                        <div className="shrink-0 text-suka-orange/0 group-hover:text-suka-orange transition-colors">
                          <ArrowRight size={20} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Sudah Terdaftar (Enroll Ulang) */}
              {enrolled.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-suka-green uppercase tracking-wider">Sudah Terdaftar ({enrolled.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {enrolled.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white p-4 rounded-2xl border-2 border-gray-100 flex items-center gap-4"
                      >
                        <div className="w-12 h-12 bg-emerald-50 text-suka-green rounded-full flex items-center justify-center font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-suka-ink truncate">{s.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{s.role} · <span className="text-suka-green font-semibold">Terdaftar</span></p>
                        </div>
                        <button
                          onClick={() => handleReEnroll(s)}
                          className="shrink-0 text-xs font-bold text-suka-brown bg-suka-cream border border-suka-orange/30 px-3 py-2 rounded-lg hover:bg-suka-orange hover:text-white transition-colors"
                        >
                          Enroll Ulang
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "consent" && targetStaff && (
        <Card className="p-5 sm:p-6 space-y-6 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="font-bold text-lg text-suka-ink">Konfirmasi Perekaman</h3>
            <button onClick={handleCancel} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-1 bg-gray-100 rounded-lg">
              Kembali
            </button>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-gray-100">
            <div className="w-14 h-14 bg-suka-brown rounded-full flex items-center justify-center text-white text-xl font-bold">
              {targetStaff.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-suka-orange uppercase tracking-wider mb-0.5">Crew Terpilih</p>
              <h4 className="font-bold text-suka-ink text-lg">{targetStaff.name}</h4>
              <p className="text-sm text-gray-500 capitalize">{targetStaff.role}</p>
            </div>
          </div>

          {isReEnroll && (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-semibold flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                Enroll Ulang: data wajah lama {targetStaff.name} akan ditimpa dan tidak bisa dikembalikan.
              </div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alasan (opsional)</label>
              <input
                type="text"
                value={reEnrollReason}
                onChange={(e) => setReEnrollReason(e.target.value)}
                placeholder="mis. wajah sering gagal terdeteksi"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-suka-orange outline-none"
              />
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-bold text-suka-ink flex items-center gap-2">
              <ShieldCheck size={18} className="text-suka-green" />
              Persetujuan Privasi (Wajib)
            </label>
            <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${consent ? 'border-suka-green bg-green-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 accent-suka-green shrink-0"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-600 leading-relaxed">
                <strong className="text-suka-ink">Persetujuan UU PDP: </strong>
                Saya, <span className="font-semibold">{targetStaff.name}</span>, menyetujui perekaman serta pemrosesan data biometrik wajah saya secara digital untuk keperluan operasional internal Suka Shawarma.
              </span>
            </label>
          </div>

          <div className="pt-2">
            <Button 
              onClick={startEnroll} 
              disabled={!consent}
              className="w-full py-4 text-lg font-bold shadow-md"
            >
              Mulai Perekaman Kamera
            </Button>
          </div>
        </Card>
      )}

      {(phase === "center" || phase === "left" || phase === "right" || phase === "saving" || phase === "done") && targetStaff && (
        <Card className="p-0 overflow-hidden rounded-2xl border-2 border-suka-green/30 shadow-lg animate-in fade-in zoom-in-95">
          <div className="p-4 bg-suka-ink text-white flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Perekaman: {targetStaff.name}</h2>
              <p className="text-xs text-gray-400">Sistem mengambil gambar otomatis</p>
            </div>
            {phase !== "saving" && phase !== "done" && (
              <button onClick={() => setPhase("consent")} className="text-sm font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">Batal</button>
            )}
          </div>

          <div className="relative bg-black min-h-[400px] flex items-center justify-center">
            {cameraError || modelError ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 text-center">
                <h2 className="text-xl font-bold text-red-400">Gagal Memuat Kamera/AI</h2>
                <p className="text-gray-300 mt-2 text-sm">{cameraError || modelError}</p>
                <Button onClick={() => setPhase("consent")} className="mt-4 bg-white text-black font-bold">Kembali</Button>
              </div>
            ) : phase !== "done" && (
              <CameraCapture 
                onReady={setVideo} 
                onError={(e) => setCameraError(e)} 
              />
            )}
            
            {/* Guide Overlays */}
            {phase !== "done" && (
              <div className="absolute inset-x-0 top-8 flex justify-center z-20">
                <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-xl flex items-center gap-3 text-suka-brown font-bold text-lg animate-bounce">
                  {phase === "center" && <><UserRound size={24} className="text-blue-500" /> Tatap Lurus ke Kamera (1/3)</>}
                  {phase === "left" && <><UserRound size={24} className="text-blue-500" /> Tetap Tatap Lurus (2/3)</>}
                  {phase === "right" && <><UserRound size={24} className="text-blue-500" /> Tetap Tatap Lurus (3/3)</>}
                  {phase === "saving" && <><Spinner className="w-5 h-5 text-suka-green" /> Menyimpan Data...</>}
                </div>
              </div>
            )}

            {/* Progress indicators */}
            {phase !== "done" && phase !== "saving" && (
              <div className="absolute bottom-8 flex gap-4 z-20">
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 1 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 2 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 3 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
              </div>
            )}

            {/* Done Overlay */}
            {phase === "done" && (
              <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8 text-center z-30">
                <CheckCircle2 size={80} className="text-suka-green mb-4" />
                <h2 className="text-2xl font-bold text-suka-ink mb-2">Enrollment Selesai!</h2>
                <p className="text-gray-500 mb-8 max-w-sm">Wajah <span className="font-bold text-suka-ink">{targetStaff.name}</span> berhasil didaftarkan. Crew sudah dapat melakukan absensi mulai sekarang.</p>
                
                <div className="flex flex-col w-full max-w-xs gap-3">
                  {unenrolled.length > 0 ? (
                    <>
                      <Button onClick={resetToNext} className="w-full font-bold py-3 text-base">
                        Lanjut Enroll Crew Berikutnya
                      </Button>
                      <Button variant="ghost" onClick={handleCancel} className="w-full font-semibold">
                        Kembali ke Daftar
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleCancel} className="w-full font-bold py-3 text-base">
                      Selesai (Semua Crew Terdaftar)
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
