"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Button, Spinner } from "@suka/design-system";
import { Settings2, Save, Zap, ToggleLeft, Building2, Search, Trash2, Plus, Timer, AlertCircle, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { saveGlobalConfig, saveOutletException, deleteOutletException, deleteAllExceptions } from "./actions";
import { useToast } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";

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

  // Marks true while the SPV has unsaved edits in the global ("Pusat") config form.
  // Guards refreshConfig from silently overwriting in-progress edits on realtime events.
  const globalDirtyRef = useRef(false);

  // Re-fetch pengaturan (global + per-outlet) dari DB, dipanggil saat realtime event masuk.
  // Idempotent: cukup baca ulang state DB terkini, tidak menulis apa pun.
  const refreshConfig = useCallback(async () => {
    const [globalRes, outletsRes, outletConfigsRes] = await Promise.all([
      supabase.from("global_settings").select("value").eq("key", "global_attendance_config").maybeSingle(),
      supabase.from("outlets").select("id, name, is_active").order("name"),
      supabase.from("outlet_attendance_config").select("*"),
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
    
    startTransition(async () => {
      try {
        await saveGlobalConfig(formData);
        globalDirtyRef.current = false;
        toast.show("ok", "Pengaturan Utama berhasil disimpan!");
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
    
    startTransition(async () => {
      try {
        await saveOutletException(formData);
        toast.show("ok", modalMode === "add" ? "Pengecualian berhasil ditambahkan!" : "Pengecualian berhasil diubah!");
        setIsModalOpen(false);
        setSelectedOutletId("");
        setNewOutletConfig({ ...globalConfig });
      } catch (err: any) {
        toast.show("err", err.message || "Gagal menyimpan pengecualian");
      }
    });
  };

  const onDeleteException = (outlet_id: string) => {
    if (!confirm("Hapus pengecualian? Outlet akan kembali memakai jam default.")) return;
    
    startTransition(async () => {
      try {
        await deleteOutletException(outlet_id);
        toast.show("ok", "Pengecualian dihapus.");
      } catch (err: any) {
        toast.show("err", err.message || "Gagal menghapus pengecualian");
      }
    });
  };
  const onDeleteAllExceptions = () => {
    if (!confirm("Peringatan: Ini akan MENGHAPUS SEMUA jam kerja khusus cabang. Semua cabang akan kembali mengikuti Aturan Pusat. Lanjutkan?")) return;
    
    startTransition(async () => {
      try {
        await deleteAllExceptions();
        toast.show("ok", "Semua jam khusus cabang telah direset ke aturan pusat.");
      } catch (err: any) {
        toast.show("err", err.message || "Gagal mereset pengecualian");
      }
    });
  };


  // Helper UI component for config form
  const ConfigFormFields = ({ config, setConfig }: { config: Config, setConfig: (c: Config) => void }) => (
    <div className="space-y-4">
      {/* Jam kerja */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-suka-ink">Jam Shift Kerja</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-suka-gray-200 p-3 bg-white">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-suka-green" /> Masuk
            </label>
            <input
              type="time" name="jam_masuk" required
              value={config.jam_masuk}
              onChange={(e) => setConfig({ ...config, jam_masuk: e.target.value })}
              className="w-full bg-transparent text-lg sm:text-xl font-bold text-suka-ink outline-none"
            />
          </div>
          <div className="rounded-xl border border-suka-gray-200 p-3 bg-white">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Pulang
            </label>
            <input
              type="time" name="jam_keluar" required
              value={config.jam_keluar}
              onChange={(e) => setConfig({ ...config, jam_keluar: e.target.value })}
              className="w-full bg-transparent text-lg sm:text-xl font-bold text-suka-ink outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-suka-ink flex items-center gap-2">
          <Timer size={16} className="text-suka-orange" /> Toleransi Telat (menit)
        </label>
        <input
          type="number" name="toleransi_menit" min="0" max="120" required
          value={config.toleransi_menit}
          onChange={(e) => setConfig({ ...config, toleransi_menit: parseInt(e.target.value) || 0 })}
          className="w-full rounded-xl border border-suka-gray-200 bg-white p-3 text-lg font-bold text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
        />
      </div>

      {/* Mode Absensi */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-suka-ink">Mode Kamera Absensi (Kiosk)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <p className="text-sm font-bold text-suka-ink">Otomatis (Sesuai Jam Shift)</p>
              <p className="text-xs text-gray-500">Kamera absensi hidup sendiri.</p>
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
              <p className="text-sm font-bold text-suka-ink">Manual (Oleh SPV)</p>
              <p className="text-xs text-gray-500">Dihidupkan dari tombol di bawah.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-20 sm:space-y-6 sm:pb-12">
      <PageHeader
        icon={<Settings2 size={24} />}
        title="Atur Jam Absensi"
        subtitle="Tetapkan jam kerja untuk seluruh outlet"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        
        {/* PANEL GLOBAL */}
        <div className="-mx-4 flex flex-col space-y-5 border-y border-suka-gray-200 bg-white p-4 shadow-sm sm:mx-0 sm:rounded-2xl sm:border sm:p-6 lg:h-fit">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-suka-ink">
              <Building2 size={20} className="text-suka-orange" /> Aturan Jam Kerja Pusat (Berlaku Umum)
            </h2>
            <p className="mt-1 text-sm text-gray-500">Aturan jam kerja yang berlaku untuk <strong>seluruh cabang</strong>, kecuali cabang yang ada di daftar Jam Kerja Khusus.</p>
          </div>
          
          <form action={onSaveGlobal} className="flex flex-col gap-6">
            <ConfigFormFields config={globalConfig} setConfig={(c) => { globalDirtyRef.current = true; setGlobalConfig(c); }} />

            <div className={`flex items-center justify-between gap-4 rounded-xl p-4 ${globalConfig.absen_window_mode === "manual" ? "bg-gray-50 border border-gray-200" : "bg-red-50 border border-red-100"}`}>
              <div>
                <p className="text-sm font-bold text-suka-ink">
                  {globalConfig.absen_window_mode === "manual" ? "Buka Kamera Absensi (Manual)" : "Kunci Kamera (Emergency Lock)"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {globalConfig.absen_window_mode === "manual" 
                    ? "Jika dinyalakan, kamera absensi di semua outlet akan aktif dan bisa digunakan." 
                    : "Jika dinyalakan, matikan paksa semua kamera absensi di outlet."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { globalDirtyRef.current = true; setGlobalConfig({ ...globalConfig, is_active: !globalConfig.is_active }); }}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  globalConfig.absen_window_mode === "manual"
                    ? (globalConfig.is_active ? "bg-suka-green" : "bg-gray-300")
                    : (!globalConfig.is_active ? "bg-red-500" : "bg-gray-300")
                }`}
              >
                <span className={`pointer-events-none m-1 inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
                  globalConfig.absen_window_mode === "manual"
                    ? (globalConfig.is_active ? "translate-x-6" : "translate-x-0")
                    : (!globalConfig.is_active ? "translate-x-6" : "translate-x-0")
                }`} />
              </button>
            </div>



            <Button type="submit" disabled={isPending} className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base">
              {isPending ? <Spinner className="h-5 w-5 text-white" /> : <><Save size={18} /> Simpan Pengaturan Utama</>}
            </Button>
          </form>
        </div>

        {/* PANEL PENGECUALIAN */}
        <div className="-mx-4 flex flex-col space-y-4 border-y border-suka-gray-200 bg-white p-4 shadow-sm sm:mx-0 sm:rounded-2xl sm:border sm:p-6 lg:h-fit">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-suka-ink">
                <AlertCircle size={20} className="text-suka-brown" /> Jam Kerja Khusus Cabang
              </h2>
              <p className="mt-1 text-sm text-gray-500">Cabang yang memiliki aturan jam kerja tersendiri.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={onDeleteAllExceptions}
                disabled={isPending || filteredConfigs.length === 0}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full text-sm font-semibold border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} /> Reset Semua Cabang
              </Button>
              <Button 
                size="sm" 
                onClick={() => { setModalMode("add"); setNewOutletConfig({ ...globalConfig, is_active: true }); setIsModalOpen(true); }} 
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full text-sm font-semibold"
              >
                <Plus size={16} /> Tambah Khusus
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari outlet khusus..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
            />
          </div>

          <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
            {filteredConfigs.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                {search ? "Outlet khusus tidak ditemukan." : "Belum ada outlet khusus. Semua outlet mengikuti jam default."}
              </div>
            ) : (
              filteredConfigs.map((cfg) => {
                const outlet = outlets.find(o => o.id === cfg.outlet_id);
                return (
                  <div key={cfg.outlet_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between">
                      <p className="font-bold text-suka-ink text-base">{outlet?.name || 'Unknown Outlet'}</p>
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
                          className="rounded-lg p-2 text-gray-400 hover:bg-suka-orange/10 hover:text-suka-orange transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => onDeleteException(cfg.outlet_id)}
                          disabled={isPending}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-2">
                        <span className="text-xs text-gray-500 block mb-0.5">Jam Masuk</span>
                        <strong className="text-suka-ink">{cfg.jam_masuk?.slice(0,5)}</strong>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2">
                        <span className="text-xs text-gray-500 block mb-0.5">Jam Pulang</span>
                        <strong className="text-suka-ink">{cfg.jam_keluar?.slice(0,5)}</strong>
                      </div>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="w-full max-w-md animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 rounded-t-3xl sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 shrink-0">
              <h3 className="text-xl font-bold text-suka-ink">
                {modalMode === "add" ? "Tambah Outlet Khusus" : "Edit Outlet Khusus"}
              </h3>
            </div>
            
            <form action={onSaveException} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5 pb-8 sm:pb-6">
                <div>
                  <label className="text-sm font-bold text-suka-ink mb-2 block">Pilih Outlet</label>
                  {modalMode === "add" ? (
                    <Select
                      value={selectedOutletId}
                      onChange={val => setSelectedOutletId(val)}
                      options={availableOutlets.map(out => ({ label: out.name, value: out.id }))}
                      placeholder="-- Pilih Outlet --"
                      className="w-full"
                      searchable
                    />
                  ) : (
                    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm text-suka-ink font-semibold">
                      {outlets.find(o => o.id === selectedOutletId)?.name || "Unknown Outlet"}
                    </div>
                  )}
                </div>

                <ConfigFormFields config={newOutletConfig} setConfig={setNewOutletConfig} />

                {/* Toggle Kunci Mesin untuk spesifik cabang ini */}
                <div className={`flex items-center justify-between gap-4 rounded-xl p-4 ${newOutletConfig.absen_window_mode === "manual" ? "bg-gray-50 border border-gray-200" : "bg-red-50 border border-red-100"}`}>
                  <div>
                    <p className="text-sm font-bold text-suka-ink">
                      {newOutletConfig.absen_window_mode === "manual" ? "Buka Kamera Absensi (Manual)" : "Kunci Kamera (Emergency Lock)"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {newOutletConfig.absen_window_mode === "manual" 
                        ? "Jika dinyalakan, kamera absensi khusus cabang ini akan aktif dan bisa digunakan." 
                        : "Jika dinyalakan, matikan paksa kamera absensi di cabang ini."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewOutletConfig({ ...newOutletConfig, is_active: !newOutletConfig.is_active })}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                      newOutletConfig.absen_window_mode === "manual"
                        ? (newOutletConfig.is_active ? "bg-suka-green" : "bg-gray-300")
                        : (!newOutletConfig.is_active ? "bg-red-500" : "bg-gray-300")
                    }`}
                  >
                    <span className={`pointer-events-none m-1 inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
                      newOutletConfig.absen_window_mode === "manual"
                        ? (newOutletConfig.is_active ? "translate-x-6" : "translate-x-0")
                        : (!newOutletConfig.is_active ? "translate-x-6" : "translate-x-0")
                    }`} />
                  </button>
                </div>
                <input type="hidden" name="is_active" value={newOutletConfig.is_active ? "true" : "false"} />
              </div>

              <div className="px-5 py-4 pb-6 sm:pb-4 sm:px-6 shrink-0 bg-white border-t border-gray-100 flex gap-3 mt-auto">
                <Button type="button" variant="secondary" className="flex-1 py-3" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button type="submit" className="flex-1 py-3" disabled={isPending || !selectedOutletId}>
                  {isPending ? <Spinner className="w-5 h-5 text-white" /> : "Simpan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
