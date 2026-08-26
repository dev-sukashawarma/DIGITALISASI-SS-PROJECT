"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button, Spinner } from "@suka/design-system";
import { Save, Zap, ToggleLeft, Building2, Search, Trash2, Plus, Timer, Pencil, ShieldCheck, ShieldAlert, Sparkles, Clock, X } from "lucide-react";
import { Select } from "@/components/Select";
import { saveGlobalConfig, saveOutletException, deleteOutletException, deleteAllExceptions } from "./actions";
import { useToast } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase";
import { useRealtimeChannel } from "@suka/realtime";
import { useAuth } from "@suka/auth";

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

const SETTINGS_ALLOWED_ROLES = ["admin", "admin_hr", "owner", "regional_manager"];

export default function PengaturanClient({ initialGlobalConfig, initialOutlets, initialOutletConfigs }: Props) {
  const { outletStaff } = useAuth();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(() => createClient(), []);

  const [globalConfig, setGlobalConfig] = useState<Config>(initialGlobalConfig);
  const [outlets, setOutlets] = useState<Outlet[]>(initialOutlets);
  const [outletConfigs, setOutletConfigs] = useState<OutletConfig[]>(initialOutletConfigs);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [newOutletConfig, setNewOutletConfig] = useState<Config>({ ...globalConfig });

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isSettingsAllowed = SETTINGS_ALLOWED_ROLES.includes(outletStaff?.role || "");

  const globalDirtyRef = useRef(false);

  const refreshConfig = useCallback(async () => {
    const [globalRes, outletsRes, outletConfigsRes] = await Promise.all([
      supabase.from("global_settings").select("value").eq("key", "global_attendance_config").maybeSingle(),
      supabase.from("outlets").select("id, name, is_active").order("name").limit(200),
      supabase.from("outlet_attendance_config").select("*").limit(200),
    ]);

    let cfgRaw: any = globalRes.data?.value;
    if (typeof cfgRaw === "string") {
      try {
        cfgRaw = JSON.parse(cfgRaw);
      } catch {
        cfgRaw = null;
      }
    }
    if (cfgRaw && !globalDirtyRef.current) {
      setGlobalConfig(prev => ({
        jam_masuk: cfgRaw.jam_masuk?.slice(0, 5) || prev.jam_masuk,
        jam_keluar: cfgRaw.jam_keluar?.slice(0, 5) || prev.jam_keluar,
        toleransi_menit: cfgRaw.toleransi_menit ?? prev.toleransi_menit,
        is_active: prev.is_active,
        absen_window_mode: cfgRaw.absen_window_mode || prev.absen_window_mode,
      }));
    }
    if (outletsRes.data) setOutlets(outletsRes.data);
    if (outletConfigsRes.data) setOutletConfigs(outletConfigsRes.data as OutletConfig[]);
  }, [supabase]);

  useRealtimeChannel({
    channelName: "absensi-pengaturan",
    enabled: true,
    subs: [
      { table: "outlet_attendance_config", handler: () => refreshConfig() },
      { table: "global_settings", handler: () => refreshConfig() },
    ],
  });

  const filteredConfigs = outletConfigs.filter(cfg => {
    const outlet = outlets.find(o => o.id === cfg.outlet_id);
    if (!outlet) return false;
    return outlet.name.toLowerCase().includes(search.toLowerCase());
  });

  const availableOutlets = outlets.filter(o => !outletConfigs.find(c => c.outlet_id === o.id));

  const onSaveGlobal = (formData: FormData) => {
    formData.set("absen_window_mode", globalConfig.absen_window_mode);
    formData.set("is_active", globalConfig.is_active ? "true" : "false");
    if (outletStaff?.id) formData.set("caller_staff_id", outletStaff.id);
    
    startTransition(async () => {
      try {
        await saveGlobalConfig(formData);
        globalDirtyRef.current = false;
        toast.show("ok", "Pengaturan Jam Kerja Pusat berhasil disimpan!");
      } catch (err: any) {
        toast.show("err", err.message || "Gagal menyimpan pengaturan");
      }
    });
  };

  const onSaveException = (formData: FormData) => {
    if (!selectedOutletId) {
      toast.show("err", "Pilih outlet terlebih dahulu");
      return;
    }
    formData.set("outlet_id", selectedOutletId);
    formData.set("absen_window_mode", newOutletConfig.absen_window_mode);
    if (outletStaff?.id) formData.set("caller_staff_id", outletStaff.id);
    
    startTransition(async () => {
      try {
        await saveOutletException(formData);
        toast.show("ok", modalMode === "add" ? "Pengecualian cabang berhasil ditambahkan!" : "Pengecualian cabang berhasil diubah!");
        setIsModalOpen(false);
        setSelectedOutletId("");
        setNewOutletConfig({ ...globalConfig });
      } catch (err: any) {
        toast.show("err", err.message || "Gagal menyimpan pengecualian");
      }
    });
  };

  const onDeleteException = (outlet_id: string) => {
    if (!confirm("Hapus jam kerja khusus cabang ini? Cabang akan otomatis mengikuti Aturan Pusat.")) return;
    
    startTransition(async () => {
      try {
        await deleteOutletException(outlet_id, outletStaff?.id);
        toast.show("ok", "Pengecualian cabang berhasil dihapus.");
      } catch (err: any) {
        toast.show("err", err.message || "Gagal menghapus pengecualian");
      }
    });
  };

  const onDeleteAllExceptions = () => {
    if (!confirm("Peringatan Eksekutif: Ini akan MENGHAPUS SEMUA jam kerja khusus cabang. Semua cabang akan kembali mengikuti Aturan Pusat secara serentak. Lanjutkan?")) return;
    
    startTransition(async () => {
      try {
        await deleteAllExceptions(outletStaff?.id);
        toast.show("ok", "Semua jam khusus cabang telah direset ke aturan pusat.");
      } catch (err: any) {
        toast.show("err", err.message || "Gagal mereset pengecualian");
      }
    });
  };

  // Helper UI component for config form
  const ConfigFormFields = ({ config, setConfig }: { config: Config, setConfig: (c: Config) => void }) => (
    <div className="space-y-5">
      {/* Jam kerja Shift */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-orange-500" />
            Rentang Shift Kerja
          </label>
          <span className="text-[11px] text-slate-500 font-medium">Format 24 Jam (WIB)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Jam Masuk
            </label>
            <input
              type="time" name="jam_masuk" required
              value={config.jam_masuk}
              onChange={(e) => setConfig({ ...config, jam_masuk: e.target.value })}
              className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
            />
          </div>

          <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Jam Pulang
            </label>
            <input
              type="time" name="jam_keluar" required
              value={config.jam_keluar}
              onChange={(e) => setConfig({ ...config, jam_keluar: e.target.value })}
              className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
            />
          </div>
        </div>

        {/* Quick Shift Presets */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Preset:</span>
          <button
            type="button"
            onClick={() => setConfig({ ...config, jam_masuk: "09:00", jam_keluar: "17:00" })}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 font-semibold transition-colors shrink-0 text-[11px]"
          >
            09:00 - 17:00 (Kantor/HQ)
          </button>
          <button
            type="button"
            onClick={() => setConfig({ ...config, jam_masuk: "10:00", jam_keluar: "22:00" })}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 font-semibold transition-colors shrink-0 text-[11px]"
          >
            10:00 - 22:00 (Outlet Reguler)
          </button>
          <button
            type="button"
            onClick={() => setConfig({ ...config, jam_masuk: "11:00", jam_keluar: "23:00" })}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 font-semibold transition-colors shrink-0 text-[11px]"
          >
            11:00 - 23:00 (Outlet Malam)
          </button>
        </div>
      </div>

      {/* Toleransi Menit */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Timer size={14} className="text-orange-500" />
            Batas Toleransi Keterlambatan
          </span>
          <span className="text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
            {config.toleransi_menit} Menit
          </span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number" name="toleransi_menit" min="0" max="120" required
            value={config.toleransi_menit}
            onChange={(e) => setConfig({ ...config, toleransi_menit: parseInt(e.target.value) || 0 })}
            className="w-28 rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-lg font-black text-slate-900 outline-none focus:border-orange-500 focus:bg-white transition-all text-center"
          />
          <div className="flex items-center gap-1.5 flex-1">
            {[0, 10, 15, 30].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setConfig({ ...config, toleransi_menit: m })}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  config.toleransi_menit === m
                    ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {m === 0 ? "0m" : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Kamera Absensi */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
          Mode Operasional Kamera Kiosk
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "auto" })}
            className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
              config.absen_window_mode === "auto" 
                ? "border-orange-500 bg-orange-50/50 shadow-sm" 
                : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"
            }`}
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold ${
              config.absen_window_mode === "auto" ? "bg-orange-500 text-white shadow-sm" : "bg-slate-200 text-slate-500"
            }`}>
              <Zap size={16} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">Otomatis (Shift)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Kamera aktif otomatis saat jendela jam shift dimulai.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setConfig({ ...config, absen_window_mode: "manual" })}
            className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
              config.absen_window_mode === "manual" 
                ? "border-orange-500 bg-orange-50/50 shadow-sm" 
                : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"
            }`}
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold ${
              config.absen_window_mode === "manual" ? "bg-orange-500 text-white shadow-sm" : "bg-slate-200 text-slate-500"
            }`}>
              <ToggleLeft size={16} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">Manual (Oleh SPV)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Kamera diaktifkan atau dikunci secara manual oleh leader/admin.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  if (!isSettingsAllowed) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl p-8 border border-amber-200/80 shadow-xl shadow-amber-500/5 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-200">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Akses Konfigurasi Dibatasi</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Konfigurasi jam kerja dan toleransi absensi merupakan kebijakan terpusat yang hanya dapat diubah oleh <strong>Regional Manager, Admin HR, Admin, dan Owner</strong>.
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20 sm:pb-12">
      {/* Executive Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-950 via-slate-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-orange-950/10">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Sparkles size={12} />
            Executive Control Center
          </div>
          <h1 className="text-2xl font-black tracking-tight">Pengaturan Jadwal & Jam Absensi</h1>
          <p className="text-xs sm:text-sm text-slate-300">Konfigurasikan batas jam masuk, jam pulang, dan batas toleransi outlet Suka Shawarma</p>
        </div>
        <div className="shrink-0 flex items-center gap-2.5 bg-white/10 backdrop-blur px-4 py-2.5 rounded-2xl border border-white/15">
          <ShieldCheck size={20} className="text-emerald-400" />
          <div className="text-xs">
            <span className="text-slate-300 block text-[10px] leading-tight">Otoritas Pengaturan</span>
            <span className="font-bold text-white capitalize">{outletStaff?.role?.replace("_", " ") || "Administrator"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 items-start">
        
        {/* PANEL ATURAN PUSAT */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Building2 size={20} className="text-orange-600" /> Aturan Jam Kerja Pusat
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                Default Master
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Berlaku otomatis untuk <strong>seluruh cabang</strong>, kecuali cabang yang didaftarkan pada daftar jam khusus.
            </p>
          </div>
          
          <form action={onSaveGlobal} className="space-y-6">
            <ConfigFormFields 
              config={globalConfig} 
              setConfig={(c) => { globalDirtyRef.current = true; setGlobalConfig(c); }} 
            />

            {/* Emergency / Manual Camera Lock Banner */}
            <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 border transition-all ${
              globalConfig.absen_window_mode === "manual" 
                ? "bg-slate-50 border-slate-200" 
                : (!globalConfig.is_active ? "bg-rose-50 border-rose-200" : "bg-emerald-50/50 border-emerald-200")
            }`}>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  {globalConfig.absen_window_mode === "manual" ? "Status Kamera Kiosk (Manual)" : "Emergency Camera Lock (Pusat)"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {globalConfig.absen_window_mode === "manual" 
                    ? "Aktifkan agar kamera Kiosk seluruh cabang siap menerima absensi." 
                    : (!globalConfig.is_active ? "Kamera di seluruh cabang sedang DIKUNCI DARURAT." : "Kamera Kiosk beroperasi normal sesuai jadwal.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { globalDirtyRef.current = true; setGlobalConfig({ ...globalConfig, is_active: !globalConfig.is_active }); }}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  globalConfig.absen_window_mode === "manual"
                    ? (globalConfig.is_active ? "bg-emerald-500" : "bg-slate-300")
                    : (!globalConfig.is_active ? "bg-rose-500" : "bg-slate-300")
                }`}
              >
                <span className={`pointer-events-none m-1 inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${
                  globalConfig.absen_window_mode === "manual"
                    ? (globalConfig.is_active ? "translate-x-6" : "translate-x-0")
                    : (!globalConfig.is_active ? "translate-x-6" : "translate-x-0")
                }`} />
              </button>
            </div>

            <button 
              type="submit" 
              disabled={isPending} 
              className="w-full flex items-center justify-center gap-2 py-4 px-6 text-sm font-black rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/10 transition-all disabled:opacity-50"
            >
              {isPending ? <Spinner className="h-5 w-5 text-white" /> : <><Save size={18} /> Simpan Pengaturan Utama Pusat</>}
            </button>
          </form>
        </div>

        {/* PANEL PENGECUALIAN CABANG */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">
                  Jam Khusus Cabang
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                  {outletConfigs.length} Cabang
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Cabang yang beroperasi dengan jadwal berbeda.</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setModalMode("add"); setNewOutletConfig({ ...globalConfig, is_active: true }); setIsModalOpen(true); }} 
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/15 transition-all"
              >
                <Plus size={14} /> Tambah Khusus
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama outlet khusus..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredConfigs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-2">
                <p className="text-xs text-slate-400 font-medium">
                  {search ? "Tidak ditemukan cabang khusus dengan kata kunci tersebut." : "Belum ada jadwal khusus. Semua cabang otomatis mengikuti Aturan Pusat."}
                </p>
              </div>
            ) : (
              filteredConfigs.map((cfg) => {
                const outlet = outlets.find(o => o.id === cfg.outlet_id);
                return (
                  <div key={cfg.outlet_id} className="rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-orange-300 hover:shadow-md transition-all p-4">
                    <div className="mb-2.5 flex items-start justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">{outlet?.name || 'Cabang Tidak Dikenal'}</p>
                        <span className="text-[10px] text-slate-500 font-semibold">Toleransi: {cfg.toleransi_menit}m</span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setModalMode("edit");
                            setSelectedOutletId(cfg.outlet_id);
                            setNewOutletConfig({
                              jam_masuk: cfg.jam_masuk || "00:00",
                              jam_keluar: cfg.jam_keluar || "00:00",
                              toleransi_menit: cfg.toleransi_menit || 0,
                              absen_window_mode: cfg.absen_window_mode || "auto",
                              is_active: outlet?.is_active ?? true,
                            });
                            setIsModalOpen(true);
                          }}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          title="Edit Jadwal Cabang"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => onDeleteException(cfg.outlet_id)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus Jadwal Khusus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white border border-slate-200/80 p-2.5">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Jam Masuk</span>
                        <strong className="text-slate-900 font-black text-sm">{cfg.jam_masuk?.slice(0,5)}</strong>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200/80 p-2.5">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Jam Pulang</span>
                        <strong className="text-slate-900 font-black text-sm">{cfg.jam_keluar?.slice(0,5)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filteredConfigs.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={onDeleteAllExceptions}
                disabled={isPending}
                className="w-full py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} /> Reset Seluruh Pengecualian Cabang
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH/EDIT PENGECUALIAN */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <form action={onSaveException} className="w-full max-w-lg animate-in slide-in-from-bottom-8 rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden border border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {modalMode === "add" ? "Tambah Jadwal Khusus Cabang" : "Edit Jadwal Khusus Cabang"}
                </h3>
                <p className="text-xs text-slate-500">Tentukan jam masuk dan kepulangan spesifik untuk cabang ini</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 block">Pilih Cabang Outlet</label>
                {modalMode === "add" ? (
                  <Select
                    value={selectedOutletId}
                    onChange={val => setSelectedOutletId(val)}
                    options={availableOutlets.map(out => ({ label: out.name, value: out.id }))}
                    placeholder="-- Pilih Cabang Outlet --"
                    className="w-full"
                    searchable
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm text-slate-900 font-bold">
                    {outlets.find(o => o.id === selectedOutletId)?.name || "Cabang Outlet"}
                  </div>
                )}
              </div>

              <ConfigFormFields config={newOutletConfig} setConfig={setNewOutletConfig} />

              <input type="hidden" name="is_active" value={newOutletConfig.is_active ? "true" : "false"} />
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                type="button" 
                className="flex-1 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all" 
                onClick={() => setIsModalOpen(false)}
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 text-xs font-black bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50" 
                disabled={isPending || !selectedOutletId}
              >
                {isPending ? <Spinner className="w-4 h-4 text-white mx-auto" /> : "Simpan Jadwal Cabang"}
              </button>
            </div>
          </form>
        </div>
      , document.body)}
    </div>
  );
}
