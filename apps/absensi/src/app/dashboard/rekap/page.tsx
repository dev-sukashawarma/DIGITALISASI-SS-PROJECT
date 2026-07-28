"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { LogIn, LogOut, ClipboardList, Download, Store, User, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";
import { useRealtimeInvalidate } from "@suka/realtime";
import { OutletSwitcher } from "@/components/OutletSwitcher";
import dayjs from "dayjs";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat";
  selfie_url: string | null;
  outlet_staff_id: string;
  outlet_staff: { name: string } | null;
  delay_minutes?: number | null;
  telat_menit?: number | null;
};

type StaffSummary = {
  staff_id: string;
  name: string;
  total_masuk: number;
  total_telat: number;
  total_alpha: number;
  total_cepat: number;
  latest_photo_url: string | null;
  rows: Row[];
};

const SELFIE_BUCKET = "selfies";

const PERIOD_OPTIONS = [
  { label: "Hari Ini", value: "hari_ini" },
  { label: "Kemarin", value: "kemarin" },
  { label: "Bulan Ini", value: "bulan_ini" },
];

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [period, setPeriod] = useState("bulan_ini");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null);

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  const { startDate, endDate } = useMemo(() => {
    let start, end;
    const now = dayjs();
    switch (period) {
      case "hari_ini":
        start = now.format("YYYY-MM-DD");
        end = start;
        break;
      case "kemarin":
        start = now.subtract(1, "day").format("YYYY-MM-DD");
        end = start;
        break;
      case "bulan_ini":
        start = now.startOf("month").format("YYYY-MM-DD");
        end = now.format("YYYY-MM-DD");
        break;
      default:
        start = now.format("YYYY-MM-DD");
        end = start;
    }
    return { startDate: start, endDate: end };
  }, [period]);

  const { data: rows = [], isPending } = useQuery({
    queryKey: ["rekap", selectedOutletId, startDate, endDate],
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const res = await fetch(`/api/attendance/rekap?outlet_id=${selectedOutletId}&start_date=${startDate}&end_date=${endDate}`);
      const resData = await res.json();
      if (!resData.ok) throw new Error(resData.error || "Gagal memuat rekap");
      return (resData.rows || []) as Row[];
    },
  });

  useRealtimeInvalidate({
    channelName: `absensi-rekap-${selectedOutletId || "none"}`,
    enabled: !!selectedOutletId,
    subs: [
      { table: "attendance", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["rekap", selectedOutletId, startDate, endDate]] },
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["rekap", selectedOutletId, startDate, endDate]] },
    ],
  });

  const staffSummaries = useMemo(() => {
    const map = new Map<string, StaffSummary>();
    
    rows.forEach(r => {
      const staffId = r.outlet_staff_id;
      if (!staffId) return;
      
      if (!map.has(staffId)) {
        map.set(staffId, {
          staff_id: staffId,
          name: r.outlet_staff?.name || "-",
          total_masuk: 0,
          total_telat: 0,
          total_alpha: 0,
          total_cepat: 0,
          latest_photo_url: null,
          rows: []
        });
      }
      
      const s = map.get(staffId)!;
      s.rows.push(r);
      if (r.selfie_url && !s.latest_photo_url) {
        s.latest_photo_url = r.selfie_url;
      }
      
      if (r.type === "in" && r.status !== "alpha") s.total_masuk++;
      if (r.status === "telat" || r.status === "pulang_telat") s.total_telat++;
      if (r.status === "alpha") s.total_alpha++;
      if (r.status === "lebih_awal") s.total_cepat++;
    });
    
    return Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
  }, [rows]);

  const globalSummary = useMemo(() => {
    return {
      masuk: staffSummaries.reduce((acc, s) => acc + s.total_masuk, 0),
      telat: staffSummaries.reduce((acc, s) => acc + s.total_telat, 0),
      alpha: staffSummaries.reduce((acc, s) => acc + s.total_alpha, 0),
      cepat: staffSummaries.reduce((acc, s) => acc + s.total_cepat, 0),
    }
  }, [staffSummaries]);

  const STAT = [
    { label: "Kehadiran (Masuk)", value: globalSummary.masuk, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    { label: "Terlambat", value: globalSummary.telat, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
    { label: "Alpha / Tidak Hadir", value: globalSummary.alpha, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" },
    { label: "Pulang Cepat", value: globalSummary.cepat, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-100" },
  ];

  const headerAndSwitcher = (
    <>
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="Rekap & Riwayat"
        subtitle="Laporan ringkasan & detail kehadiran per karyawan"
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Select
              value={period}
              onChange={val => setPeriod(val)}
              options={PERIOD_OPTIONS}
              className="w-[150px]"
            />
            <button
              onClick={() => exportCsv()}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />
      <OutletSwitcher currentOutletId={selectedOutletId} onChange={setSelectedOutletId} />
    </>
  );

  if (!selectedOutletId) {
    return (
      <div className="space-y-5">
        {headerAndSwitcher}
        <div className="p-6 mt-10">
          <EmptyState 
            icon={<Store size={48} className="text-gray-400" />} 
            title="Cabang Belum Ditentukan" 
            description="Akun Anda belum terhubung dengan cabang manapun. Silakan hubungi admin untuk pengaturan penempatan." 
          />
        </div>
      </div>
    );
  }

  function formatTanggal(ts: string) {
    return dayjs(ts).format("DD MMM YYYY");
  }

  function jam(ts: string) {
    return dayjs(ts).format("HH:mm");
  }

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function formatStatusText(status: string) {
    switch (status) {
      case "telat": return "Masuk Telat";
      case "lebih_awal": return "Pulang Cepat";
      case "pulang_telat": return "Pulang Lama";
      case "tepat": return "Tepat Waktu";
      case "alpha": return "Alpha";
      default: return status;
    }
  }

  function exportCsv() {
    const data: CsvRow[] = rows.map((r) => ({
      name: r.outlet_staff?.name ?? "-",
      type: r.type === "in" ? "Masuk" : "Keluar",
      jam: r.status === "alpha" ? "-" : `${formatTanggal(r.ts_server)} ${jam(r.ts_server)}`,
      status: formatStatusText(r.status),
    }));
    downloadCsv(`rekap-${period}.csv`, attendanceToCsv(data));
  }

  return (
    <div className="space-y-6 pb-20 relative">
      {headerAndSwitcher}

      {/* Global Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {STAT.map((s) => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 sm:p-5 flex flex-col`}>
            <div className={`text-xs font-semibold uppercase tracking-wider ${s.text} opacity-80`}>{s.label}</div>
            <div className={`mt-2 text-3xl font-extrabold ${s.text}`}>{isPending ? "-" : s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-lg font-bold text-slate-800">Ringkasan Karyawan</span>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {staffSummaries.length === 0 && !isPending && (
           <EmptyState icon={<User size={28} />} title="Belum ada data" description="Tidak ada aktivitas absensi di periode ini." />
        )}
        
        {isPending && <div className="p-10 text-center text-slate-500 font-medium animate-pulse">Memuat data...</div>}

        <div className="divide-y divide-slate-100">
          {staffSummaries.map(staff => (
            <div 
              key={staff.staff_id} 
              onClick={() => setSelectedStaff(staff)}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              {staff.latest_photo_url ? (
                <img 
                  src={selfieUrl(staff.latest_photo_url)} 
                  alt="selfie" 
                  className="h-12 w-12 shrink-0 rounded-full object-cover border border-slate-200 bg-slate-100" 
                />
              ) : (
                <Avatar name={staff.name} size={48} />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-slate-800 truncate">{staff.name}</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                  <span className="font-medium text-emerald-600">{staff.total_masuk} Hadir</span>
                  {staff.total_telat > 0 && <span className="font-medium text-amber-600">{staff.total_telat} Telat</span>}
                  {staff.total_alpha > 0 && <span className="font-medium text-rose-600">{staff.total_alpha} Alpha</span>}
                  {staff.total_cepat > 0 && <span className="font-medium text-sky-600">{staff.total_cepat} Plg Cepat</span>}
                </div>
              </div>

              <div className="shrink-0 text-slate-300 group-hover:text-slate-600 transition-colors">
                <ChevronRight size={20} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Slide-over / Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <Avatar name={selectedStaff.name} size={40} />
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight">{selectedStaff.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">Detail Kehadiran</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaff(null)} 
                className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {selectedStaff.rows.length === 0 ? (
                <div className="text-center p-8 text-slate-500">Tidak ada riwayat detail.</div>
              ) : (
                selectedStaff.rows.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                    {r.selfie_url ? (
                      <img 
                        src={selfieUrl(r.selfie_url)} 
                        alt="selfie" 
                        onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                        className="h-14 w-14 shrink-0 cursor-pointer rounded-xl object-cover border border-slate-100 bg-slate-100" 
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-300">
                         <X size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pt-0.5">
                       <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{formatTanggal(r.ts_server)}</span>
                          <StatusPill kind={r.status} className="capitalize text-[10px] px-2 py-0.5">
                            {formatStatusText(r.status)} {r.delay_minutes ? `${r.delay_minutes}m` : ""}
                          </StatusPill>
                       </div>
                       <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          {r.type === "in" ? <LogIn size={14} className="text-emerald-500" /> : <LogOut size={14} className="text-amber-500" />}
                          {r.type === "in" ? "Masuk" : "Keluar"}
                          {r.status !== "alpha" && <span className="ml-1 text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">{jam(r.ts_server)}</span>}
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Preview */}
      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 backdrop-blur-md transition-opacity">
          <img src={preview} alt="selfie besar" className="max-h-[85vh] max-w-full rounded-3xl shadow-2xl border-2 border-white/20" />
        </div>
      )}
    </div>
  );
}
