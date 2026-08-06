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
  status: "tepat" | "telat" | "telat_toleransi" | "alpha" | "lebih_awal" | "pulang_telat";
  selfie_url: string | null;
  outlet_staff_id: string;
  outlet_staff: { name: string } | null;
  delay_minutes?: number | null;
  telat_menit?: number | null;
  is_manual_button?: boolean;
};

type StaffSummary = {
  staff_id: string;
  name: string;
  total_masuk: number;
  total_telat: number;
  total_telat_toleransi: number;
  total_alpha: number;
  total_cepat: number;
  latest_photo_url: string | null;
  latest_in: Row | null;
  latest_out: Row | null;
  rows: Row[];
};

const SELFIE_BUCKET = "selfies";

const PERIOD_OPTIONS = [
  { label: "Hari Ini", value: "hari_ini" },
  { label: "Kemarin", value: "kemarin" },
  { label: "Bulan Ini", value: "bulan_ini" },
  { label: "Kustom...", value: "custom" },
];

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [period, setPeriod] = useState("hari_ini");
  const [customStart, setCustomStart] = useState(() => dayjs().startOf("month").format("YYYY-MM-DD"));
  const [customEnd, setCustomEnd] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [filterStatus, setFilterStatus] = useState("semua");
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
      case "custom":
        start = customStart;
        end = customEnd;
        break;
      default:
        start = now.format("YYYY-MM-DD");
        end = start;
    }
    return { startDate: start, endDate: end };
  }, [period, customStart, customEnd]);

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
          total_telat_toleransi: 0,
          total_alpha: 0,
          total_cepat: 0,
          latest_photo_url: null,
          latest_in: null,
          latest_out: null,
          rows: []
        });
      }
      
      const s = map.get(staffId)!;
      s.rows.push(r);
      if (r.selfie_url && !s.latest_photo_url) {
        s.latest_photo_url = r.selfie_url;
      }
      if (r.type === "in" && r.status !== "alpha" && !s.latest_in) s.latest_in = r;
      if (r.type === "out" && !s.latest_out) s.latest_out = r;
      
      if (r.type === "in" && r.status !== "alpha") s.total_masuk++;
      if (r.status === "telat" || r.status === "pulang_telat") s.total_telat++;
      if (r.status === "telat_toleransi") s.total_telat_toleransi++;
      if (r.status === "alpha") s.total_alpha++;
      if (r.status === "lebih_awal") s.total_cepat++;
    });
    
    let result = Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
    if (filterStatus !== "semua") {
      result = result.filter(s => {
        if (filterStatus === "masuk") return s.total_masuk > 0;
        if (filterStatus === "telat") return s.total_telat > 0;
        if (filterStatus === "telat_toleransi") return s.total_telat_toleransi > 0;
        if (filterStatus === "alpha") return s.total_alpha > 0;
        if (filterStatus === "lebih_awal") return s.total_cepat > 0;
        return true;
      });
    }
    return result;
  }, [rows, filterStatus]);

  const globalSummary = useMemo(() => {
    return {
      masuk: staffSummaries.reduce((acc, s) => acc + s.total_masuk, 0),
      telat: staffSummaries.reduce((acc, s) => acc + s.total_telat + s.total_telat_toleransi, 0),
      alpha: staffSummaries.reduce((acc, s) => acc + s.total_alpha, 0),
      cepat: staffSummaries.reduce((acc, s) => acc + s.total_cepat, 0),
    }
  }, [staffSummaries]);

  const detailByDate = useMemo(() => {
    if (!selectedStaff) return [];
    const groups = new Map<string, { in?: Row, out?: Row, alpha?: Row, dateTs: string }>();

    for (const r of selectedStaff.rows) {
      const d = dayjs(r.ts_server).format("DD MMM YYYY");
      const existing = groups.get(d) || { dateTs: r.ts_server };
      if (r.status === "alpha") {
        existing.alpha = r;
      } else if (r.type === "in") {
        existing.in = r;
      } else if (r.type === "out") {
        existing.out = r;
      }
      groups.set(d, existing);
    }

    return Array.from(groups.values()).sort((a, b) => new Date(b.dateTs).getTime() - new Date(a.dateTs).getTime());
  }, [selectedStaff]);

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
          <div className="flex w-full items-center gap-2 sm:w-auto flex-wrap sm:flex-nowrap">
            <Select
              value={period}
              onChange={val => setPeriod(val)}
              options={PERIOD_OPTIONS}
              className="w-[140px]"
            />
            {period === "custom" && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm h-[40px]">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm outline-none bg-transparent text-slate-700 font-medium" />
                <span className="text-slate-400 font-medium">-</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} min={customStart} className="text-sm outline-none bg-transparent text-slate-700 font-medium" />
              </div>
            )}
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
      case "telat_toleransi": return "Telat (Toleransi)";
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
        <Select
          value={filterStatus}
          onChange={val => setFilterStatus(val)}
          options={[
            { label: "Semua Status", value: "semua" },
            { label: "Hadir", value: "masuk" },
            { label: "Telat", value: "telat" },
            { label: "Telat (Toleransi)", value: "telat_toleransi" },
            { label: "Alpha", value: "alpha" },
            { label: "Pulang Cepat", value: "lebih_awal" }
          ]}
          className="w-[160px]"
        />
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
                  {staff.total_telat_toleransi > 0 && <span className="font-medium text-yellow-600">{staff.total_telat_toleransi} Telat (Tol)</span>}
                  {staff.total_alpha > 0 && <span className="font-medium text-rose-600">{staff.total_alpha} Alpha</span>}
                  {staff.total_cepat > 0 && <span className="font-medium text-sky-600">{staff.total_cepat} Plg Cepat</span>}
                </div>
                {(staff.latest_in || staff.latest_out) && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {staff.latest_in && (
                      <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <LogIn size={12} className="text-emerald-500" />
                        <span>In: <span className="font-semibold text-slate-800">{jam(staff.latest_in.ts_server)}</span></span>
                        {(staff.latest_in.delay_minutes || staff.latest_in.telat_menit) ? (
                          <span className="text-rose-500 ml-1 font-medium">Telat {staff.latest_in.delay_minutes || staff.latest_in.telat_menit}m</span>
                        ) : null}
                      </div>
                    )}
                    {staff.latest_out && (
                      <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <LogOut size={12} className="text-amber-500" />
                        <span>Out: <span className="font-semibold text-slate-800">{jam(staff.latest_out.ts_server)}</span></span>
                        {(staff.latest_out.delay_minutes || staff.latest_out.telat_menit) ? (
                          <span className="text-rose-500 ml-1 font-medium">Cepat {staff.latest_out.delay_minutes || staff.latest_out.telat_menit}m</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
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
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {detailByDate.length === 0 ? (
                <div className="text-center p-8 text-slate-500">Tidak ada riwayat detail.</div>
              ) : (
                detailByDate.map(day => {
                  const isAlpha = !day.in && day.alpha;
                  const dateStr = formatTanggal(day.dateTs);

                  return (
                    <div key={dateStr} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-50">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{dateStr}</span>
                        {isAlpha && <StatusPill kind="alpha" className="text-[10px] px-2 py-0.5">Alpha</StatusPill>}
                      </div>
                      
                      {!isAlpha && (
                        <div className="flex flex-col gap-3">
                          {/* Masuk */}
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {day.in?.selfie_url ? (
                                <img 
                                  src={selfieUrl(day.in.selfie_url)} 
                                  alt="selfie masuk"
                                  onClick={() => setPreview(selfieUrl(day.in!.selfie_url!))}
                                  className="h-10 w-10 shrink-0 cursor-pointer rounded-xl object-cover border border-slate-200 bg-slate-100" 
                                />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                                   <LogIn size={18} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                  <LogIn size={14} className="text-emerald-500" />
                                  Masuk
                                </div>
                                {day.in && (
                                  <StatusPill kind={day.in.status} className="capitalize text-[10px] px-2 py-0.5">
                                    {formatStatusText(day.in.status)} {day.in.delay_minutes ? `${day.in.delay_minutes}m` : ""}
                                  </StatusPill>
                                )}
                              </div>
                                <div className="text-sm mt-0.5 flex flex-wrap gap-2 items-center">
                                  {day.in ? (
                                    <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">{jam(day.in.ts_server)}</span>
                                  ) : (
                                    <span className="text-slate-400 italic text-xs">Belum / Tidak ada data</span>
                                  )}
                                  {day.in?.is_manual_button && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Manual
                                    </span>
                                  )}
                                </div>
                            </div>
                          </div>

                          {/* Pulang */}
                          <div className="flex items-start gap-3 pt-3 border-t border-slate-50">
                            <div className="mt-0.5">
                              {day.out?.selfie_url ? (
                                <img 
                                  src={selfieUrl(day.out.selfie_url)} 
                                  alt="selfie pulang"
                                  onClick={() => setPreview(selfieUrl(day.out!.selfie_url!))}
                                  className="h-10 w-10 shrink-0 cursor-pointer rounded-xl object-cover border border-slate-200 bg-slate-100" 
                                />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                                   <LogOut size={18} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                  <LogOut size={14} className="text-amber-500" />
                                  Pulang
                                </div>
                                {day.out && (
                                  <StatusPill kind={day.out.status} className="capitalize text-[10px] px-2 py-0.5">
                                    {formatStatusText(day.out.status)} {day.out.delay_minutes ? `${day.out.delay_minutes}m` : ""}
                                  </StatusPill>
                                )}
                              </div>
                                <div className="text-sm mt-0.5 flex flex-wrap gap-2 items-center">
                                  {day.out ? (
                                    <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">{jam(day.out.ts_server)}</span>
                                  ) : (
                                    <span className="text-slate-400 italic text-xs">Belum Absen Pulang</span>
                                  )}
                                  {day.out?.is_manual_button && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Manual
                                    </span>
                                  )}
                                </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
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
