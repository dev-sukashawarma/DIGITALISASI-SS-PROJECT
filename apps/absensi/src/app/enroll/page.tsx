"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { loadFaceModels, extractDescriptor } from "@/lib/face/recognizer";
import { averageDescriptors } from "@/lib/face/match";

type Staff = { id: string; name: string };

export default function EnrollPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [targetId, setTargetId] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [shots, setShots] = useState<number[][]>([]);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadFaceModels();
    if (!outletStaff) return;
    supabase
      .from("outlet_staff")
      .select("id,name")
      .eq("outlet_id", outletStaff.outlet_id)
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [outletStaff]);

  async function takeShot() {
    if (!video) return;
    const d = await extractDescriptor(video);
    if (!d) return setMsg("Wajah tidak terdeteksi.");
    setShots((prev) => [...prev, d]);
    setMsg(`Foto ${shots.length + 1}/3 diambil.`);
  }

  async function save() {
    if (!targetId || shots.length === 0 || !consent || !outletStaff || !video) return;
    const descriptor = averageDescriptors(shots);
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
    setMsg(error ? `❌ ${error.message}` : "✅ Enroll tersimpan.");
    setShots([]);
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Enroll Wajah Staff</h1>
      <select
        className="w-full border rounded p-2"
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
      >
        <option value="">Pilih staff…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Staff menyetujui pemrosesan data biometrik (UU PDP).
      </label>
      {targetId && consent && (
        <Card>
          <CameraCapture onReady={setVideo} onError={setMsg} />
          <div className="flex gap-2 mt-3">
            <Button onClick={takeShot} disabled={shots.length >= 3}>
              Ambil foto ({shots.length}/3)
            </Button>
            <Button onClick={save} disabled={shots.length === 0}>
              Simpan
            </Button>
          </div>
        </Card>
      )}
      {msg && <p className="text-center">{msg}</p>}
    </div>
  );
}
