"use client";

/**
 * HALAMAN DIAGNOSTIK SEMENTARA — bukan fitur produksi.
 * Tujuan: mengukur skor kemiripan wajah di kondisi kamera nyata untuk
 * memisahkan dua hipotesis root-cause false-accept:
 *   H-A: descriptor tak diskriminatif (own-ke-own ≈ own-ke-orang-lain)
 *   H-B: parameter metrik salah skala (own-ke-own >> own-ke-orang-lain)
 * Hapus halaman ini setelah investigasi selesai.
 */

import { useEffect, useRef, useState } from "react";
import { Card, Spinner, Button } from "@suka/design-system";
import { useAuth } from "@suka/auth";
import { createClient } from "@/lib/supabase";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels, getHuman } from "@/lib/face/recognizer";
import { faceSimilarity, euclideanDistance, DEFAULT_MATCH_THRESHOLD } from "@/lib/face/match";
import { OutletSwitcher } from "@/components/OutletSwitcher";

type Cand = { id: string; name: string; descriptor: number[] };
type Row = { name: string; dim: number; appSim: number | null; eucl: number | null; cos: number | null };

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function l2(a: number[]): number { return Math.sqrt(a.reduce((s, x) => s + x * x, 0)); }

export default function FaceDebugPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidatesRef = useRef<Cand[]>([]);
  const [candCount, setCandCount] = useState(0);

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff, selectedOutletId]);

  const [liveInfo, setLiveInfo] = useState<{ dim: number; norm: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  // live-vs-live
  const [capA, setCapA] = useState<number[] | null>(null);
  const [capB, setCapB] = useState<number[] | null>(null);

  useEffect(() => {
    loadFaceModels().then(() => setModelsReady(true)).catch((e) => setError(e.message || "Gagal muat model"));
  }, []);

  useEffect(() => {
    if (!selectedOutletId) return;
    supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", selectedOutletId)
      .not("face_descriptor", "is", null)
      .then(({ data }) => {
        candidatesRef.current = ((data as any[]) ?? [])
          .filter((s) => s.face_descriptor)
          .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor as number[] }));
        setCandCount(candidatesRef.current.length);
      });
  }, [selectedOutletId, supabase]);

  async function detectLive(): Promise<number[] | null> {
    const v = videoRef.current;
    if (!v || v.readyState < 2) { setError("Kamera belum siap"); return null; }
    const human = await getHuman();
    const res = await human.detect(v);
    if (!res.face || res.face.length === 0 || !res.face[0].embedding) { setError("Wajah tak terdeteksi"); return null; }
    setError(null);
    return Array.from(res.face[0].embedding);
  }

  async function captureAndCompare() {
    setBusy(true);
    try {
      const live = await detectLive();
      if (!live) return;
      setLiveInfo({ dim: live.length, norm: l2(live) });
      const out: Row[] = candidatesRef.current.map((c) => {
        if (c.descriptor.length !== live.length) {
          return { name: c.name, dim: c.descriptor.length, appSim: null, eucl: null, cos: null };
        }
        return {
          name: c.name,
          dim: c.descriptor.length,
          appSim: faceSimilarity(live, c.descriptor),
          eucl: euclideanDistance(live, c.descriptor),
          cos: cosine(live, c.descriptor),
        };
      });
      out.sort((a, b) => (b.appSim ?? -1) - (a.appSim ?? -1));
      setRows(out);
    } finally { setBusy(false); }
  }

  async function capture(slot: "A" | "B") {
    setBusy(true);
    try {
      const live = await detectLive();
      if (!live) return;
      if (slot === "A") setCapA(live); else setCapB(live);
    } finally { setBusy(false); }
  }

  const liveVsLive = capA && capB && capA.length === capB.length
    ? { appSim: faceSimilarity(capA, capB), eucl: euclideanDistance(capA, capB), cos: cosine(capA, capB) }
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-suka-ink">Diagnostik Wajah</h1>
        <OutletSwitcher 
          selectedOutletId={selectedOutletId} 
          onOutletChange={setSelectedOutletId} 
        />
      </div>

      <Card className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50">
        <h1 className="text-lg font-bold text-amber-800">🔬 Diagnostik Wajah (sementara)</h1>
        <p className="text-sm text-amber-700 mt-1">
          Threshold app = <b>{DEFAULT_MATCH_THRESHOLD}</b> · Enrollment ter-muat: <b>{candCount}</b> · Outlet: {selectedOutletId?.slice(0, 8) ?? "-"}
        </p>
      </Card>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">{error}</div>}

      <Card className="p-0 overflow-hidden rounded-2xl">
        <div className="bg-black min-h-[320px] flex items-center justify-center">
          {modelsReady ? <CameraCapture onReady={(v) => (videoRef.current = v)} onError={setError} />
            : <div className="text-white flex items-center gap-2"><Spinner /> Memuat model…</div>}
        </div>
        <div className="p-4 space-y-3">
          <Button onClick={captureAndCompare} disabled={!modelsReady || busy} className="w-full font-bold py-3">
            {busy ? "Memproses…" : "Tangkap & Bandingkan ke Semua Enrollment"}
          </Button>
          {liveInfo && (
            <p className="text-xs text-gray-500 font-semibold">Live: dim {liveInfo.dim} · L2 norm {liveInfo.norm.toFixed(3)}</p>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-4 rounded-2xl">
          <h2 className="font-bold text-suka-ink mb-3">Wajah live vs enrollment (urut skor app)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-1 pr-3">Nama</th><th className="pr-3">dim</th>
                  <th className="pr-3">app-sim</th><th className="pr-3">eucl</th><th className="pr-3">cos</th><th>verdict</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 font-semibold text-suka-ink">{r.name}</td>
                    <td className="pr-3">{r.dim}</td>
                    <td className="pr-3 font-bold">{r.appSim === null ? "—" : r.appSim.toFixed(4)}</td>
                    <td className="pr-3">{r.eucl === null ? "—" : r.eucl.toFixed(3)}</td>
                    <td className="pr-3">{r.cos === null ? "—" : r.cos.toFixed(4)}</td>
                    <td>{r.appSim === null ? <span className="text-gray-400">dim beda</span>
                      : r.appSim >= DEFAULT_MATCH_THRESHOLD ? <span className="text-red-600 font-bold">LOLOS</span>
                        : <span className="text-suka-green font-bold">tolak</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Scan wajahmu sendiri: barismu sendiri (enrollment-mu) harusnya skor jauh lebih tinggi dari orang lain. Kalau setara → descriptor tak diskriminatif (H-A).
          </p>
        </Card>
      )}

      <Card className="p-4 rounded-2xl space-y-3">
        <h2 className="font-bold text-suka-ink">Bandingkan 2 tangkapan langsung (single-frontal)</h2>
        <p className="text-xs text-gray-500">Tes averaging: tangkap orang 1 ke A, orang 2 ke B (dua orang BERBEDA, hadap depan). Lihat skornya.</p>
        <div className="flex gap-3">
          <Button onClick={() => capture("A")} disabled={!modelsReady || busy} variant="ghost" className="flex-1 font-bold border">
            Tangkap A {capA ? "✓" : ""}
          </Button>
          <Button onClick={() => capture("B")} disabled={!modelsReady || busy} variant="ghost" className="flex-1 font-bold border">
            Tangkap B {capB ? "✓" : ""}
          </Button>
        </div>
        {liveVsLive && (
          <div className="p-3 bg-slate-50 rounded-xl text-sm font-semibold text-suka-ink">
            A vs B → app-sim <b>{liveVsLive.appSim.toFixed(4)}</b> · eucl {liveVsLive.eucl.toFixed(3)} · cos {liveVsLive.cos.toFixed(4)}
            {" "}{liveVsLive.appSim >= DEFAULT_MATCH_THRESHOLD ? <span className="text-red-600">(LOLOS — dianggap sama!)</span> : <span className="text-suka-green">(tolak)</span>}
          </div>
        )}
        {capA && capB && capA.length !== capB.length && <p className="text-xs text-red-600">Dimensi A/B beda — tak bisa dibandingkan.</p>}
      </Card>
    </div>
  );
}
