"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { loadFaceModels, extractDescriptor } from "@/lib/face/recognizer";
import { isMatch } from "@/lib/face/match";
import { useAttendanceQueue } from "@/lib/attendance/useAttendanceQueue";
import { submitAttendance } from "@/lib/attendance/submit";
import type { AttendancePayload } from "@/lib/attendance/types";

type Staff = { id: string; name: string; face_descriptor: number[] | null };

export default function ClockPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const queue = useAttendanceQueue();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadFaceModels();
    if (!outletStaff) return;
    supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletStaff.outlet_id)
      .not("face_descriptor", "is", null)
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [outletStaff]);

  async function doClock(type: "in" | "out") {
    if (!selected || !video || !outletStaff) return;
    setMsg("Memproses wajah...");

    const live = await extractDescriptor(video);
    if (!live) return setMsg("Wajah tidak terdeteksi, coba lagi.");
    if (!selected.face_descriptor || !isMatch(live, selected.face_descriptor)) {
      return setMsg("❌ Wajah tidak cocok.");
    }

    setMsg("Mengambil lokasi...");
    let pos: GeolocationPosition;
    try {
      pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true }),
      );
    } catch {
      return setMsg("Tidak bisa mengambil lokasi. Aktifkan GPS.");
    }

    const { dataUrl } = captureFrame(video);
    const id = crypto.randomUUID();
    const payload: AttendancePayload = {
      id,
      outlet_staff_id: selected.id,
      type,
      gps_lat: pos.coords.latitude,
      gps_lng: pos.coords.longitude,
      match_distance: 0,
      selfie_path: null,
      ts_client: new Date().toISOString(),
      from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      return setMsg("📴 Tersimpan offline, akan sinkron saat online.");
    }

    // Online: upload selfie dulu, baru submit
    const path = `${outletStaff.outlet_id}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage
      .from("selfies")
      .upload(path, blob, { contentType: "image/jpeg" });

    const { data: s } = await supabase.auth.getSession();
    const res = await submitAttendance(
      { ...payload, selfie_path: path },
      {
        functionUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`,
        accessToken: s.session!.access_token,
      },
    );

    setMsg(
      res.ok
        ? `✅ Absen ${res.status}`
        : `❌ ${res.reason}${res.distance_m ? ` (${res.distance_m}m dari outlet)` : ""}`,
    );
  }

  // Auto-flush queue saat online
  useEffect(() => {
    if (navigator.onLine && outletStaff) queue.flush(outletStaff.outlet_id);
  }, [outletStaff]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Absensi</h1>
      <select
        className="w-full border rounded p-2"
        onChange={(e) => setSelected(staff.find((s) => s.id === e.target.value) ?? null)}
      >
        <option value="">Pilih nama…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {selected && (
        <Card>
          <CameraCapture onReady={setVideo} onError={setMsg} />
          <div className="flex gap-2 mt-3">
            <Button onClick={() => doClock("in")}>Clock-in</Button>
            <Button onClick={() => doClock("out")}>Clock-out</Button>
          </div>
        </Card>
      )}
      {msg && <p className="text-center">{msg}</p>}
      {!queue.isOnline && (
        <p className="text-amber-600 text-sm">
          Offline — {queue.pending} absen menunggu sync
        </p>
      )}
    </div>
  );
}
