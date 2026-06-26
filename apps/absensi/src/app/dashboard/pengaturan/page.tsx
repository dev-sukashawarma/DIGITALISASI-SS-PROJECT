"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner } from "@suka/design-system";
import { Clock, Timer, Settings2, Save, Lock, Unlock, Zap, ToggleLeft } from "lucide-react";
import { useAuth } from '@suka/auth';
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
import { PageHeader } from "@/components/PageHeader";

type Config = {
  jam_masuk: string;
  jam_keluar: string;
  toleransi_menit: number;
  is_active: boolean;
  absen_window_mode: "auto" | "manual";
};

export default function PengaturanAbsensiPage() {
  const { outletStaff } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Config>({ jam_masuk: "09:00", jam_keluar: "17:00", toleransi_menit: 15, is_active: false, absen_window_mode: "auto" });

  const { isLoading } = useQuery({
    queryKey: ["pengaturan", outletStaff?.outlet_id],
    enabled: !!outletStaff?.outlet_id,
    staleTime: 5 * 60_000, // pengaturan jarang berubah, cache 5 menit
    queryFn: async () => {
      const [cfg, out] = await Promise.all([
        supabase.from("outlet_attendance_config").select("jam_masuk,jam_keluar,toleransi_menit,absen_window_mode").eq("outlet_id", outletStaff!.outlet_id).single(),
        supabase.from("outlets").select("is_active").eq("id", outletStaff!.outlet_id).single()
      ]);
      if (cfg.data && out.data) {
        setConfig({
          jam_masuk: cfg.data.jam_masuk.slice(0, 5),
          jam_keluar: cfg.data.jam_keluar?.slice(0, 5) || "17:00",
          toleransi_menit: cfg.data.toleransi_menit,
          is_active: out.data.is_active,
          absen_window_mode: (cfg.data.absen_window_mode as "auto" | "manual") ?? "auto",
        });
      }
      return cfg.data;
    },
  });

  const handleSave = async () => {
    if (!outletStaff?.outlet_id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/outlet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_id: outletStaff.outlet_id, ...config })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.show("ok", "Pengaturan berhasil disimpan!");
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e.message}`);
    }
    setSaving(false);
  };

  if (isLoading) return <div className="p-12 flex justify-center"><Spinner /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <PageHeader
        icon={<Settings2 size={20} />}
        title="Pengaturan Absensi"
        subtitle="Kelola status kiosk, jam kerja, dan toleransi keterlambatan"
      />

      {/* Mode Absensi */}
      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-suka-ink">
          <ToggleLeft size={18} className="text-suka-brown" /> Mode Absensi Kiosk
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Otomatis */}
          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "auto" })}
            className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              config.absen_window_mode === "auto"
                ? "border-suka-orange bg-orange-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.absen_window_mode === "auto" ? "bg-suka-orange text-white" : "bg-gray-100 text-gray-400"}`}>
              <Zap size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-suka-ink">Otomatis (Time Window)</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Kiosk buka sendiri 1 jam sebelum masuk & tutup 30 mnt sebelum pulang. SPV tidak perlu toggle tiap hari.
              </p>
            </div>
          </button>
          {/* Manual */}
          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "manual" })}
            className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
              config.absen_window_mode === "manual"
                ? "border-suka-orange bg-orange-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.absen_window_mode === "manual" ? "bg-suka-orange text-white" : "bg-gray-100 text-gray-400"}`}>
              <ToggleLeft size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-suka-ink">Manual (Toggle SPV)</p>
              <p className="mt-0.5 text-xs text-gray-500">
                SPV buka dan tutup kiosk secara manual. Fleksibel untuk jadwal tidak tetap.
              </p>
            </div>
          </button>
        </div>

        {/* Toggle is_active — hanya tampil di mode manual ATAU sebagai emergency lock di mode auto */}
        <div className={`flex items-center justify-between gap-4 rounded-xl p-4 ${config.absen_window_mode === "manual" ? "bg-gray-50 border border-gray-200" : "bg-amber-50 border border-amber-200"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.is_active ? "bg-green-100 text-suka-green" : "bg-red-100 text-red-500"}`}>
              {config.is_active ? <Unlock size={18} /> : <Lock size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-suka-ink">
                {config.absen_window_mode === "manual" ? "Status Kiosk" : "🔒 Emergency Lock"}
                {" "}<span className={`text-xs font-medium ${config.is_active ? "text-suka-green" : "text-red-500"}`}>
                  {config.is_active ? "Terbuka" : "Terkunci"}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {config.absen_window_mode === "manual"
                  ? "Toggle untuk buka/tutup kiosk absensi manual."
                  : "Paksa kunci kiosk di luar siklus normal. Gunakan untuk kondisi darurat."}
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={config.is_active}
            onClick={() => setConfig({ ...config, is_active: !config.is_active })}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-suka-orange/30 ${config.is_active ? "bg-suka-green" : "bg-gray-300"}`}
          >
            <span className={`pointer-events-none m-0.5 inline-block h-7 w-7 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${config.is_active ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Jam kerja */}
      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-suka-ink">
          <Clock size={18} className="text-suka-brown" /> Jam Shift Kerja
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-suka-gray-200 p-4">
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-suka-green" /> Jam mulai masuk
            </label>
            <input
              type="time"
              value={config.jam_masuk}
              onChange={(e) => setConfig({ ...config, jam_masuk: e.target.value })}
              className="w-full rounded-xl bg-suka-gray-50 py-3 text-center text-2xl font-bold text-suka-ink outline-none focus:ring-2 focus:ring-suka-green/30"
            />
          </div>

          <div className="rounded-xl border border-suka-gray-200 p-4">
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Jam boleh pulang
            </label>
            <input
              type="time"
              value={config.jam_keluar}
              onChange={(e) => setConfig({ ...config, jam_keluar: e.target.value })}
              className="w-full rounded-xl bg-suka-gray-50 py-3 text-center text-2xl font-bold text-suka-ink outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-suka-gray-200 p-4">
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Timer size={14} /> Toleransi keterlambatan (menit)
          </label>
          <input
            type="number" min="0" max="120"
            value={config.toleransi_menit}
            onChange={(e) => setConfig({ ...config, toleransi_menit: parseInt(e.target.value) || 0 })}
            className="w-full max-w-[140px] rounded-xl bg-suka-gray-50 py-2.5 text-center text-xl font-bold text-suka-ink outline-none focus:ring-2 focus:ring-suka-orange/30 sm:max-w-[180px]"
          />
          <p className="mt-2.5 text-xs text-gray-500 sm:text-sm">
            Kru yang absen setelah <strong className="text-suka-ink">{config.jam_masuk}</strong> tapi masih dalam <strong className="text-suka-ink">{config.toleransi_menit} menit</strong> tetap dihitung <strong className="text-suka-green">Tepat Waktu</strong>.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 sm:w-auto sm:px-8"
        >
          {saving ? <Spinner className="w-5 h-5 text-white" /> : <><Save size={18} /> Simpan Perubahan</>}
        </Button>
      </div>
    </div>
  );
}
