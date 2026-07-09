"use client";

import { useState, useEffect } from "react";
import { Button, Spinner } from "@suka/design-system";
import { Clock, Timer, Settings2, Save, Lock, Unlock, Zap, ToggleLeft, Building2, Search, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/feedback/toast";
import { PageHeader } from "@/components/PageHeader";

type Config = {
  jam_masuk: string;
  jam_keluar: string;
  toleransi_menit: number;
  is_active?: boolean;
  absen_window_mode: "auto" | "manual";
};

type Outlet = {
  id: string;
  name: string;
  is_active: boolean;
};

type OutletConfig = Config & {
  outlet_id: string;
};

type Props = {
  initialGlobalConfig: Config;
  initialOutlets: Outlet[];
  initialOutletConfigs: OutletConfig[];
};

export default function PengaturanClient({ initialGlobalConfig, initialOutlets, initialOutletConfigs }: Props) {
  const supabase = createClient();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [savingOutlet, setSavingOutlet] = useState<string | null>(null);
  
  // States
  const [globalConfig, setGlobalConfig] = useState<Config>(initialGlobalConfig);
  const [outlets, setOutlets] = useState<Outlet[]>(initialOutlets);
  const [outletConfigs, setOutletConfigs] = useState<OutletConfig[]>(initialOutletConfigs);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [newOutletConfig, setNewOutletConfig] = useState<Config>({ ...globalConfig });

  // Supabase Realtime Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("pengaturan-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_settings" },
        (payload) => {
          if (payload.new && (payload.new as any).key === "global_attendance_config") {
            const val = (payload.new as any).value;
            setGlobalConfig({
              jam_masuk: val.jam_masuk?.slice(0, 5) || "09:00",
              jam_keluar: val.jam_keluar?.slice(0, 5) || "17:00",
              toleransi_menit: val.toleransi_menit || 15,
              absen_window_mode: val.absen_window_mode || "auto",
              is_active: globalConfig.is_active // keep local state or sync if we add it globally
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outlet_attendance_config" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newCfg = payload.new as OutletConfig;
            setOutletConfigs(prev => {
              const exists = prev.find(p => p.outlet_id === newCfg.outlet_id);
              if (exists) return prev.map(p => p.outlet_id === newCfg.outlet_id ? newCfg : p);
              return [...prev, newCfg];
            });
          } else if (payload.eventType === "DELETE") {
            setOutletConfigs(prev => prev.filter(p => p.outlet_id !== (payload.old as any).outlet_id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outlets" },
        (payload) => {
          const newOutlet = payload.new as Outlet;
          setOutlets(prev => prev.map(o => o.id === newOutlet.id ? { ...o, is_active: newOutlet.is_active } : o));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, globalConfig.is_active]);

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/outlet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          applyTo: "all", 
          ...globalConfig 
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.show("ok", "Pengaturan Global berhasil disimpan!");
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e.message}`);
    }
    setSaving(false);
  };

  const handleSaveOutletConfig = async () => {
    if (!selectedOutletId) {
      toast.show("err", "Pilih outlet terlebih dahulu!");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/outlet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          applyTo: "specific", 
          outletIds: [selectedOutletId],
          ...newOutletConfig 
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.show("ok", "Pengecualian berhasil ditambahkan!");
      setIsModalOpen(false);
      setSelectedOutletId("");
    } catch (e: any) {
      toast.show("err", `Gagal menambah pengecualian: ${e.message}`);
    }
    setSaving(false);
  };

  const handleDeleteOutletConfig = async (outlet_id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengecualian ini? Outlet akan kembali mengikuti pengaturan global.")) return;
    setSavingOutlet(outlet_id);
    try {
      const res = await fetch(`/api/outlet-config?outlet_id=${outlet_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.show("ok", "Pengecualian dihapus. Outlet kembali ke setelan global.");
    } catch (e: any) {
      toast.show("err", `Gagal menghapus: ${e.message}`);
    }
    setSavingOutlet(null);
  };

  // Helper UI component for config form
  const ConfigForm = ({ config, setConfig, isGlobal = false }: { config: Config, setConfig: (c: Config) => void, isGlobal?: boolean }) => (
    <div className="space-y-4">
      {/* Mode Absensi */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-suka-ink">Mode Absensi Kiosk</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "auto" })}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
              config.absen_window_mode === "auto" ? "border-suka-orange bg-orange-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.absen_window_mode === "auto" ? "bg-suka-orange text-white" : "bg-gray-100 text-gray-400"}`}>
              <Zap size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-suka-ink">Otomatis</p>
              <p className="text-xs text-gray-500">Buka/tutup otomatis.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "manual" })}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
              config.absen_window_mode === "manual" ? "border-suka-orange bg-orange-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.absen_window_mode === "manual" ? "bg-suka-orange text-white" : "bg-gray-100 text-gray-400"}`}>
              <ToggleLeft size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-suka-ink">Manual</p>
              <p className="text-xs text-gray-500">Toggle on/off manual.</p>
            </div>
          </button>
        </div>
      </div>

      {isGlobal && (
        <div className={`flex items-center justify-between gap-4 rounded-xl p-3 ${config.absen_window_mode === "manual" ? "bg-gray-50 border border-gray-200" : "bg-amber-50 border border-amber-200"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-suka-ink">
                {config.absen_window_mode === "manual" ? "Status Kiosk (Semua Outlet)" : "Emergency Lock"}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            onClick={() => setConfig({ ...config, is_active: !config.is_active })}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${config.is_active ? "bg-suka-green" : "bg-gray-300"}`}
          >
            <span className={`pointer-events-none m-0.5 inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${config.is_active ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      )}

      {/* Jam kerja */}
      <div>
        <label className="text-sm font-bold text-suka-ink mb-3 block">Jam Shift Kerja</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-suka-gray-200 p-3">
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-suka-green" /> Masuk
            </label>
            <input
              type="time"
              value={config.jam_masuk}
              onChange={(e) => setConfig({ ...config, jam_masuk: e.target.value })}
              className="w-full rounded-lg bg-suka-gray-50 py-2 text-center text-xl font-bold text-suka-ink outline-none focus:ring-2 focus:ring-suka-green/30"
            />
          </div>
          <div className="rounded-xl border border-suka-gray-200 p-3">
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Pulang
            </label>
            <input
              type="time"
              value={config.jam_keluar}
              onChange={(e) => setConfig({ ...config, jam_keluar: e.target.value })}
              className="w-full rounded-lg bg-suka-gray-50 py-2 text-center text-xl font-bold text-suka-ink outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-suka-gray-200 p-3">
          <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Timer size={14} /> Toleransi Telat (menit)
          </label>
          <input
            type="number" min="0" max="120"
            value={config.toleransi_menit}
            onChange={(e) => setConfig({ ...config, toleransi_menit: parseInt(e.target.value) || 0 })}
            className="w-full rounded-lg bg-suka-gray-50 py-2 text-center text-lg font-bold text-suka-ink outline-none focus:ring-2 focus:ring-suka-orange/30"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <PageHeader
        icon={<Settings2 size={20} />}
        title="Pengaturan Absensi"
        subtitle="Kelola jam kerja, toleransi keterlambatan, dan status kiosk secara realtime"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL GLOBAL */}
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-5 shadow-sm space-y-5 h-fit">
          <div className="border-b pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-suka-ink">
              <Building2 size={20} className="text-suka-orange" /> Pengaturan Global
            </h2>
            <p className="mt-1 text-sm text-gray-500">Standar default untuk semua outlet.</p>
          </div>
          
          <ConfigForm config={globalConfig} setConfig={setGlobalConfig} isGlobal={true} />

          <Button
            onClick={handleSaveGlobal}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3"
          >
            {saving ? <Spinner className="w-5 h-5 text-white" /> : <><Save size={18} /> Simpan Global</>}
          </Button>
        </div>

        {/* PANEL PENGECUALIAN */}
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-5 shadow-sm space-y-5 h-fit">
          <div className="border-b pb-4 flex justify-between items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-suka-ink">
                <Settings2 size={20} className="text-suka-brown" /> Pengecualian Outlet
              </h2>
              <p className="mt-1 text-sm text-gray-500">Outlet dengan jam kerja berbeda.</p>
            </div>
            <Button size="sm" onClick={() => { setNewOutletConfig({ ...globalConfig }); setIsModalOpen(true); }} className="rounded-full px-3 py-1 text-xs flex items-center gap-1">
              <Plus size={14} /> Tambah
            </Button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {outletConfigs.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed rounded-xl">
                Tidak ada outlet pengecualian.<br/>Semua mengikuti Pengaturan Global.
              </div>
            ) : (
              outletConfigs.map((cfg) => {
                const outlet = outlets.find(o => o.id === cfg.outlet_id);
                return (
                  <div key={cfg.outlet_id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-gray-300">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-suka-ink">{outlet?.name || 'Unknown Outlet'}</p>
                      <button 
                        title="Hapus pengecualian"
                        onClick={() => handleDeleteOutletConfig(cfg.outlet_id)}
                        disabled={savingOutlet === cfg.outlet_id}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        {savingOutlet === cfg.outlet_id ? <Spinner className="w-4 h-4" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-white p-2 rounded-lg border">
                      <div>Masuk: <strong className="text-suka-ink">{cfg.jam_masuk?.slice(0,5)}</strong></div>
                      <div>Pulang: <strong className="text-suka-ink">{cfg.jam_keluar?.slice(0,5)}</strong></div>
                      <div>Toleransi: <strong className="text-suka-ink">{cfg.toleransi_menit}m</strong></div>
                      <div>Mode: <strong className="text-suka-ink capitalize">{cfg.absen_window_mode}</strong></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH PENGECUALIAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5 animate-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold text-suka-ink border-b pb-3">Tambah Pengecualian Outlet</h3>
            
            <div>
              <label className="text-sm font-bold text-suka-ink mb-2 block">Pilih Outlet</label>
              <select 
                value={selectedOutletId}
                onChange={e => setSelectedOutletId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 bg-gray-50 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none"
              >
                <option value="" disabled>-- Pilih Outlet --</option>
                {outlets.filter(o => !outletConfigs.find(c => c.outlet_id === o.id)).map(out => (
                  <option key={out.id} value={out.id}>{out.name}</option>
                ))}
              </select>
            </div>

            <ConfigForm config={newOutletConfig} setConfig={setNewOutletConfig} />

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button type="button" className="flex-1" onClick={handleSaveOutletConfig} disabled={saving || !selectedOutletId}>
                {saving ? <Spinner className="w-4 h-4 text-white" /> : "Simpan Pengecualian"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
