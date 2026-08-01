"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, StatusPill, EmptyState, Spinner } from "@suka/design-system";
import { LogIn, LogOut, Clock4, MoreHorizontal, Users, CalendarDays, Store, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { useRealtimeInvalidate } from "@suka/realtime";
import { type BoardRow } from "@/features/board/board";
import { InfoPill } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { OutletSwitcher } from "@/components/OutletSwitcher";

const PILL: Record<BoardRow["state"], { icon: React.ReactNode; label: (t: string | null, d: number | null) => string; colorClass?: string }> = {
  masuk:  { icon: <LogIn size={13} />,  label: (t) => `Masuk ${t}` },
  telat_toleransi: { icon: <Clock4 size={13} />, label: (t, d) => `Telat (Toleransi) ${d ? d + ' mnt' : t}` },
  telat:  { icon: <Clock4 size={13} />, label: (t, d) => `Masuk Telat ${d ? d + ' mnt' : t}` },
  keluar: { icon: <LogOut size={13} />, label: (t) => `Pulang ${t}` },
  lebih_awal: { icon: <LogOut size={13} />, label: (t) => `Pulang Cepat ${t}` },
  pulang_telat: { icon: <Clock4 size={13} />, label: (t, d) => `Pulang Lama ${d ? d + ' mnt' : t}` },
  belum:  { icon: <MoreHorizontal size={13} />, label: () => "Belum Hadir" },
  alpha:  { icon: <MoreHorizontal size={13} />, label: () => "Alpha" },
};

const SELFIE_BUCKET = "selfies";

const LEGEND = [
  { key: "hadir", label: "Hadir", dot: "bg-suka-green", text: "text-green-700", bg: "bg-green-50" },
  { key: "telat_toleransi", label: "Telat (Tol)", dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50" },
  { key: "telat", label: "Telat", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  { key: "belum", label: "Belum", dot: "bg-gray-300", text: "text-gray-700", bg: "bg-gray-50" },
  { key: "alpha", label: "Alpha", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
  { key: "total", label: "Total Staf", dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50" },
] as const;

export default function PapanKehadiranPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const isSpvOrAdmin = ["spv", "owner", "admin", "admin_hr", "regional_manager"].includes(outletStaff?.role || "");

  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["papan-kehadiran", selectedOutletId, today],
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const res = await fetch(`/api/attendance/papan?outlet_id=${selectedOutletId}&date=${today}`);
      const resData = await res.json();
      if (!resData.ok) throw new Error(resData.error || "Gagal memuat papan kehadiran");
      return resData;
    },
  });

  useRealtimeInvalidate({
    channelName: `absensi-papan-${selectedOutletId || "none"}`,
    enabled: !!selectedOutletId,
    subs: [
      { table: "attendance", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["papan-kehadiran", selectedOutletId, today]] },
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["papan-kehadiran", selectedOutletId, today]] },
      { table: "global_settings", queryKeys: [["papan-kehadiran", selectedOutletId, today]] },
    ],
  });

  const headerAndSwitcher = (
    <div className="flex flex-col gap-4 mb-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Papan Kehadiran</h1>
          <p className="text-sm text-gray-500 mt-1">Pantau kehadiran tim secara real-time hari ini.</p>
        </div>
        <div className="hidden sm:block">
          <InfoPill icon={<CalendarDays size={14} />}>
            {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </InfoPill>
        </div>
      </div>
      <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 px-3 text-sm font-medium text-gray-500">
          <Store size={16} /> Pilih Outlet:
        </div>
        <div className="flex-1">
          <OutletSwitcher currentOutletId={selectedOutletId} onChange={setSelectedOutletId} />
        </div>
      </div>
    </div>
  );

  if (!selectedOutletId) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {headerAndSwitcher}
        <div className="p-8 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="bg-gray-50 h-24 w-24 rounded-full flex items-center justify-center mb-6">
            <Store size={40} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cabang Belum Ditentukan</h2>
          <p className="text-gray-500 max-w-md">Akun Anda belum terhubung dengan cabang manapun. Silakan hubungi admin untuk pengaturan penempatan.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {headerAndSwitcher}
        <div className="p-12 flex justify-center items-center min-h-[40vh] bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="w-8 h-8 text-suka-ink" />
            <p className="text-sm text-gray-500 animate-pulse">Memuat data kehadiran...</p>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = data;
  const present = summary.hadir + summary.telat + summary.telat_toleransi;
  const pct = summary.total > 0 ? Math.round((present / summary.total) * 100) : 0;
  const hadirPct = summary.total > 0 ? (summary.hadir / summary.total) * 100 : 0;
  const telatTolPct = summary.total > 0 ? (summary.telat_toleransi / summary.total) * 100 : 0;
  const telatPct = summary.total > 0 ? (summary.telat / summary.total) * 100 : 0;
  const alphaPct = summary.total > 0 ? (summary.alpha / summary.total) * 100 : 0;

  const filteredRows = data.rows.filter((r: BoardRow) => filterStatus === "semua" || r.state === filterStatus);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {headerAndSwitcher}

      {isSpvOrAdmin && data.securityAlerts && data.securityAlerts.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-2.5 font-semibold text-red-700 mb-3 text-sm">
            <AlertTriangle size={18} className="text-red-500 animate-pulse" />
            <span>Peringatan Keamanan: Terdeteksi {data.securityAlerts.length} Percobaan Manipulasi Lokasi</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.securityAlerts.map((alert: any) => (
              <div key={alert.id} className="flex flex-col bg-white p-3.5 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-gray-900 text-sm truncate">{alert.staff_name}</span>
                  <span className="text-gray-400 font-mono text-[10px] bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                    {new Date(alert.ts_server).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-red-600 bg-red-50/50 px-2 py-1 rounded inline-block w-fit">
                  {alert.status === "fake_gps_blocked" ? "Mock Provider (Fake GPS)" : "Perpindahan Tidak Wajar"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Tingkat Kehadiran</h2>
            <p className="text-sm text-gray-500 mt-1">Persentase staf yang sudah hadir hari ini</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-tight text-gray-900">{pct}</span>
            <span className="text-lg font-semibold text-gray-400">%</span>
          </div>
        </div>
        
        <div className="relative h-3.5 overflow-hidden rounded-full bg-gray-100">
          <div className="absolute inset-y-0 left-0 bg-suka-green transition-all duration-1000 ease-out" style={{ width: `${hadirPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-yellow-400 transition-all duration-1000 ease-out" style={{ left: `${hadirPct}%`, width: `${telatTolPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-1000 ease-out" style={{ left: `${hadirPct + telatTolPct}%`, width: `${telatPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-red-500 transition-all duration-1000 ease-out" style={{ left: `${hadirPct + telatTolPct + telatPct}%`, width: `${alphaPct}%` }} />
        </div>
        
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {LEGEND.map((l) => (
            <div key={l.key} className={`flex flex-col p-3 rounded-2xl border border-gray-100 ${l.bg} hover:-translate-y-0.5 transition-transform duration-200 cursor-default`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${l.dot} shadow-sm`} />
                <span className="text-lg font-bold text-gray-900">{summary[l.key]}</span>
              </div>
              <span className={`text-xs font-semibold ${l.text}`}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* List Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
              <Users size={20} className="text-suka-ink" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Daftar Staf</h3>
              <p className="text-xs text-gray-500">{filteredRows.length} dari {summary.total} staf</p>
            </div>
          </div>
          <div className="relative">
            <Select
              value={filterStatus}
              onChange={val => setFilterStatus(val)}
              options={[
                { label: "Semua Status", value: "semua" },
                { label: "Masuk Tepat", value: "masuk" },
                { label: "Telat (Toleransi)", value: "telat_toleransi" },
                { label: "Masuk Telat", value: "telat" },
                { label: "Belum Hadir", value: "belum" },
                { label: "Alpha", value: "alpha" },
                { label: "Pulang Tepat", value: "keluar" },
                { label: "Pulang Cepat", value: "lebih_awal" },
                { label: "Pulang Lama", value: "pulang_telat" }
              ]}
              className="w-full sm:w-[200px] bg-white border-gray-200 hover:border-gray-300 transition-colors shadow-sm rounded-xl font-medium"
            />
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {filteredRows.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={<Users size={40} className="text-gray-300" />} title="Tidak ada data staf" description="Tidak ada staf yang sesuai dengan filter yang dipilih." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-px bg-gray-100">
              {filteredRows.map((r: BoardRow) => {
                const p = PILL[r.state];
                return (
                  <div key={r.id} className="flex items-center gap-4 p-4 sm:p-5 bg-white hover:bg-gray-50/80 transition-colors group">
                    <div className="relative">
                      {r.selfie_url ? (
                        <div className="relative group/img cursor-pointer" onClick={() => setPreview(selfieUrl(r.selfie_url!))}>
                          <img src={selfieUrl(r.selfie_url)} alt="selfie" 
                              className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm border border-gray-200 group-hover/img:border-suka-ink transition-colors" />
                          <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] text-white font-medium bg-black/50 px-1.5 py-0.5 rounded-md">Lihat</span>
                          </div>
                        </div>
                      ) : (
                        <Avatar name={r.name} size={48} className="shadow-sm rounded-2xl border border-gray-100" />
                      )}
                      {/* State indicator dot */}
                      <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        r.state === 'masuk' || r.state === 'keluar' ? 'bg-suka-green' : 
                        r.state === 'telat_toleransi' ? 'bg-yellow-400' :
                        r.state === 'telat' || r.state === 'pulang_telat' || r.state === 'lebih_awal' ? 'bg-amber-500' :
                        r.state === 'alpha' ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-suka-ink transition-colors">{r.name}</div>
                      <div className="text-xs font-medium text-gray-500 capitalize mt-0.5">{r.role}</div>
                    </div>
                    
                    <div className="shrink-0 flex items-center">
                      <StatusPill kind={r.state} className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold shadow-sm border border-black/5">
                        <div className="flex items-center gap-1.5">
                          {p.icon}
                          {p.label(r.time, r.delay_minutes)}
                        </div>
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 p-6 backdrop-blur-sm transition-all duration-300 animate-in fade-in zoom-in-95 cursor-zoom-out">
          <div className="relative group max-w-full">
            <button onClick={() => setPreview(null)} className="absolute -top-4 -right-4 bg-white text-gray-900 rounded-full p-2 shadow-lg hover:scale-110 transition-transform">
              <LogOut size={16} className="rotate-180" />
            </button>
            <img src={preview} alt="selfie preview" className="max-h-[85vh] max-w-full rounded-[2rem] shadow-2xl border-4 border-white/20" />
          </div>
        </div>
      )}
    </div>
  );
}
