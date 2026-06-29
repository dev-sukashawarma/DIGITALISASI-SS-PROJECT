"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@suka/auth";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";

const OutletMapPicker = dynamic(() => import("@/components/OutletMapPicker"), { ssr: false });

const ALLOWED_ROLES = ["spv", "admin", "owner", "leader"];
type Outlet = { id: string; name: string; lat: number | null; lng: number | null };

export default function PengaturanLokasiPage() {
  const { outletStaff, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const isAllowed = ALLOWED_ROLES.includes(outletStaff?.role || "");

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Guard SPV-only (defense-in-depth selain nav).
  useEffect(() => {
    if (!loading && outletStaff && !isAllowed) router.replace("/dashboard/kru");
  }, [loading, outletStaff, isAllowed, router]);

  // Muat daftar outlet.
  useEffect(() => {
    if (!isAllowed) return;
    supabase.from("outlets").select("id, name, lat, lng").order("name").then(({ data }) => {
      const rows = (data as Outlet[]) ?? [];
      setOutlets(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed, supabase]);

  // Set koordinat awal saat ganti outlet.
  useEffect(() => {
    const o = outlets.find((x) => x.id === selectedId);
    if (o) setCoords(o.lat !== null && o.lng !== null ? { lat: Number(o.lat), lng: Number(o.lng) } : null);
  }, [selectedId, outlets]);

  async function handleSave() {
    if (!selectedId || !coords) {
      toast.show("err", "Pilih outlet dan tentukan titik di peta dulu.");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.show("err", "Sesi habis, silakan login ulang."); return; }
      const res = await fetch("/api/calibrate-outlet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outlet_id: selectedId, lat: coords.lat, lng: coords.lng }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.show("ok", "Koordinat outlet tersimpan.");
        setOutlets((prev) => prev.map((o) => o.id === selectedId ? { ...o, lat: coords.lat, lng: coords.lng } : o));
      } else {
        toast.show("err", `Gagal: ${json.error ?? "tidak diketahui"}`);
      }
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Memuat…</div>;
  if (!isAllowed) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-suka-ink">Kalibrasi Lokasi Outlet</h1>
        <p className="text-sm text-gray-500">
          Geser pin ke gedung outlet sebenarnya (lihat dari satelit), lalu Simpan. Lingkaran oranye = radius absen 30 m.
        </p>
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}{o.lat === null ? " (belum ada koordinat)" : ""}
          </option>
        ))}
      </select>

      <OutletMapPicker value={coords} onChange={(lat, lng) => setCoords({ lat, lng })} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {coords ? `Pin: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "Klik peta untuk menaruh pin"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !coords}
          className="px-4 py-2 rounded-lg bg-suka-orange text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan Koordinat"}
        </button>
      </div>
    </div>
  );
}
