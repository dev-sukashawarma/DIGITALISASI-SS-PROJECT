"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card, Spinner } from "@suka/design-system";
import { Camera, Save, ShieldCheck, CheckCircle2, UserRound, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { PageHeader } from "@/components/PageHeader";
import { loadFaceModels } from "@/lib/face/recognizer";
import { averageDescriptors } from "@/lib/face/match";
import * as faceapi from "face-api.js";
import { featuresFromLandmarks } from "@/lib/face/liveness";

type Staff = { id: string; name: string };
type EnrollPhase = "idle" | "center" | "left" | "right" | "saving" | "done";

export default function EnrollPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const toast = useToast();
  
  const [staff, setStaff] = useState<Staff[]>([]);
  const [targetId, setTargetId] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  
  const [shots, setShots] = useState<number[][]>([]);
  const shotsRef = useRef<number[][]>([]); // To access within loop
  
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [phase, setPhase] = useState<EnrollPhase>("idle");
  const phaseRef = useRef<EnrollPhase>("idle");
  const busyRef = useRef(false);
  const loopRef = useRef<number | null>(null);

  useEffect(() => {
    loadFaceModels();
    if (!outletStaff) return;
    supabase
      .from("outlet_staff")
      .select("id,name")
      .eq("outlet_id", outletStaff.outlet_id)
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [outletStaff]);

  // Sync state & ref
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { shotsRef.current = shots; }, [shots]);

  // Auto capture loop
  useEffect(() => {
    if (phase === "idle" || phase === "saving" || phase === "done") {
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
        const det = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (det) {
          const features = featuresFromLandmarks(det as any);
          const yaw = features.yawRatio;
          const currentPhase = phaseRef.current;

          let shouldCapture = false;
          
          if (currentPhase === "center" && yaw >= 0.38 && yaw <= 0.62) {
            shouldCapture = true;
          } else if (currentPhase === "left" && yaw > 0.65) {
            shouldCapture = true;
          } else if (currentPhase === "right" && yaw < 0.35) {
            shouldCapture = true;
          }

          if (shouldCapture) {
            const newShots = [...shotsRef.current, Array.from(det.descriptor)];
            setShots(newShots);
            
            if (currentPhase === "center") {
              setPhase("left");
            } else if (currentPhase === "left") {
              setPhase("right");
            } else if (currentPhase === "right") {
              setPhase("saving");
              await saveAuto(newShots);
            }
            
            // Give user time to see the success flash
            await new Promise(r => setTimeout(r, 800));
          }
        }
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

  async function saveAuto(finalShots: number[][]) {
    if (!targetId || finalShots.length !== 3 || !outletStaff || !video) return;
    try {
      const descriptor = averageDescriptors(finalShots);
      const { dataUrl } = captureFrame(video);
      const refPath = `${outletStaff.outlet_id}/${targetId}.jpg`;
      const blob = await (await fetch(dataUrl)).blob();
      
      await supabase.storage
        .from("face-refs")
        .upload(refPath, blob, { upsert: true, contentType: "image/jpeg" });
        
      const { error } = await supabase
        .from("outlet_staff")
        .update({
          face_descriptor: descriptor,
          ref_photo_url: refPath,
          consent_at: new Date().toISOString(),
          consent_by: outletStaff.id,
          enrolled_at: new Date().toISOString(),
        })
        .eq("id", targetId);
        
      if (error) throw error;
      setPhase("done");
      toast.show("ok", "Enrollment Wajah Berhasil Tersimpan!");
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e.message}`);
      setPhase("idle");
      setShots([]);
    }
  }

  function startEnroll() {
    setShots([]);
    setPhase("center");
  }

  function reset() {
    setTargetId("");
    setConsent(false);
    setShots([]);
    setPhase("idle");
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      <PageHeader
        icon={<Camera size={20} />}
        title="Enroll Wajah Staf"
        subtitle="Sistem memandu pengambilan foto dari 3 sudut agar akurat"
      />

      {phase === "idle" ? (
        <Card className="p-5 sm:p-6 space-y-5 rounded-2xl">
          <div className="space-y-2">
            <label className="text-sm font-bold text-suka-ink">1. Pilih Staff yang Akan Didaftarkan</label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-lg focus:border-suka-green focus:ring-2 focus:ring-suka-green/20 outline-none"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">-- Silakan pilih --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-bold text-suka-ink">2. Persetujuan Privasi (Wajib)</label>
            <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${consent ? 'border-suka-green bg-green-50/30' : 'border-gray-200'}`}>
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 accent-suka-green"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-600">
                <strong className="text-suka-ink flex items-center gap-1"><ShieldCheck size={16} className="text-suka-green" /> Persetujuan UU PDP</strong>
                Staff yang bersangkutan hadir di tempat dan dengan sadar menyetujui perekaman serta pemrosesan data biometrik wajahnya untuk keperluan absensi kerja internal Suka Shawarma.
              </span>
            </label>
          </div>

          <div className="pt-4">
            <Button 
              onClick={startEnroll} 
              disabled={!targetId || !consent}
              className="w-full py-4 text-lg font-bold shadow-md"
            >
              Mulai Perekaman Wajah
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden rounded-2xl border-2 border-suka-green/30">
          <div className="p-4 bg-suka-green text-white text-center">
            <h2 className="text-xl font-bold">Panduan Perekaman</h2>
            <p className="text-sm opacity-90">Ikuti instruksi di layar. Sistem akan mengambil foto otomatis.</p>
          </div>

          <div className="relative bg-black min-h-[350px] flex items-center justify-center">
            {phase !== "done" && (
              <CameraCapture onReady={setVideo} onError={setMsg} />
            )}
            
            {/* Guide Overlays */}
            <div className="absolute inset-x-0 top-8 flex justify-center z-20">
              <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-xl flex items-center gap-3 text-suka-brown font-bold text-lg animate-bounce">
                {phase === "center" && <><UserRound size={24} className="text-blue-500" /> Tatap Lurus ke Kamera</>}
                {phase === "left" && <><ArrowLeft size={24} className="text-orange-500" /> Tolehkan Kepala ke Kiri</>}
                {phase === "right" && <><ArrowRight size={24} className="text-purple-500" /> Tolehkan Kepala ke Kanan</>}
                {phase === "saving" && <><Spinner className="w-5 h-5 text-suka-green" /> Menyimpan Data...</>}
              </div>
            </div>

            {/* Progress indicators */}
            {phase !== "done" && phase !== "saving" && (
              <div className="absolute bottom-8 flex gap-4 z-20">
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 1 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 2 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
                <div className={`w-3 h-3 rounded-full transition-all ${shots.length >= 3 ? 'bg-suka-green scale-125 shadow-[0_0_10px_#22c55e]' : 'bg-gray-400'}`} />
              </div>
            )}

            {phase === "done" && (
              <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8 text-center z-30">
                <CheckCircle2 size={80} className="text-suka-green mb-4" />
                <h2 className="text-2xl font-bold text-suka-ink mb-2">Perekaman Selesai!</h2>
                <p className="text-gray-500 mb-8">Wajah {staff.find(s => s.id === targetId)?.name} berhasil didaftarkan secara akurat ke dalam sistem.</p>
                <Button onClick={reset} className="px-8 font-bold">Daftarkan Staff Lain</Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
