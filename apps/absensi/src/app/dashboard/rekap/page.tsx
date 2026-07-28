"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { LogIn, LogOut, CalendarDays, ClipboardList, Download, Store } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";
import { useRealtimeInvalidate } from "@suka/realtime";
import { OutletSwitcher } from "@/components/OutletSwitcher";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
  delay_minutes?: number | null;
  telat_menit?: number | null;
};

const SELFIE_BUCKET = "selfies";



export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  const { data: rows = [] } = useQuery({
    queryKey: ["rekap", selectedOutletId, date],
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const res = await fetch(`/api/attendance/rekap?outlet_id=${selectedOutletId}&date=${date}`);
      const resData = await res.json();
      if (!resData.ok) throw new Error(resData.error || "Gagal memuat rekap");
      return (resData.rows || []) as Row[];
    },
  });

  useRealtimeInvalidate({
    channelName: `absensi-rekap-${selectedOutletId || "none"}`,
    enabled: !!selectedOutletId,
    subs: [
      { table: "attendance", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["rekap", selectedOutletId, date]] },
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${selectedOutletId}`, queryKeys: [["rekap", selectedOutletId, date]] },
      { table: "global_settings", queryKeys: [["rekap", selectedOutletId, date]] },
    ],
  });

  const summary = useMemo(() => ({
    tepat: rows.filter((r) => r.status === "tepat").length,
    telat: rows.filter((r) => r.status === "telat" || r.status === "pulang_telat").length,
    alpha: rows.filter((r) => r.status === "alpha").length,
    lebih_awal: rows.filter((r) => r.status === "lebih_awal").length,
  }), [rows]);

  const STAT = [
    { label: "Tepat", value: summary.tepat, cls: "text-suka-green" },
    { label: "Telat", value: summary.telat, cls: "text-[#854f0b]" },
    { label: "Alpha", value: summary.alpha, cls: "text-red-600" },
    { label: "Cepat", value: summary.lebih_awal, cls: "text-[#0369a1]" },
  ];

  const headerAndSwitcher = (
    <>
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="Rekap & Riwayat"
        subtitle="Riwayat absensi per tanggal"
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="flex flex-1 items-center gap-1.5 rounded-xl border border-suka-gray-300 bg-white px-3 py-2 text-sm text-gray-600 sm:flex-none">
              <CalendarDays size={15} className="shrink-0 text-gray-400" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent outline-none" />
            </label>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl bg-suka-brown px-3 py-2 text-sm font-semibold text-white hover:bg-suka-brown/90 transition-colors shadow-sm cursor-pointer"
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

  const filteredRows = rows.filter(r => filterStatus === "semua" || r.status === filterStatus);

  function jam(ts: string) {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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
      jam: r.status === "alpha" ? "-" : jam(r.ts_server),
      status: formatStatusText(r.status),
    }));
    downloadCsv(`rekap-${date}.csv`, attendanceToCsv(data));
  }

  return (
    <div className="space-y-5">
      {headerAndSwitcher}

      <div className="grid grid-cols-3 gap-2.5">
        {STAT.map((s) => (
          <div key={s.label} className="rounded-2xl border border-suka-gray-200 bg-white p-3 sm:p-4">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className={`mt-0.5 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-suka-ink">Riwayat ({filteredRows.length})</span>
        <Select
          value={filterStatus}
          onChange={val => setFilterStatus(val)}
          options={[
            { label: "Semua Status", value: "semua" },
            { label: "Tepat Waktu", value: "tepat" },
            { label: "Masuk Telat", value: "telat" },
            { label: "Alpha", value: "alpha" },
            { label: "Pulang Cepat", value: "lebih_awal" },
            { label: "Pulang Lama", value: "pulang_telat" }
          ]}
          className="w-[180px]"
        />
      </div>

      <div className="divide-y divide-suka-gray-200/70 overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
        {filteredRows.length === 0 && <EmptyState icon={<ClipboardList size={28} />} title="Belum ada data" description="Tidak ada absensi untuk tanggal/filter ini." />}
        {filteredRows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
            {r.selfie_url ? (
              <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                   className="h-10 w-10 shrink-0 cursor-pointer rounded-xl object-cover border border-suka-gray-200" />
            ) : <Avatar name={r.outlet_staff?.name ?? "?"} size={40} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-suka-ink">{r.outlet_staff?.name ?? "-"}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {r.type === "in" ? <LogIn size={13} /> : <LogOut size={13} />}
                {r.type === "in" ? "Masuk" : "Keluar"} {r.status !== "alpha" && `· ${jam(r.ts_server)}`}
              </div>
            </div>
            <StatusPill kind={r.status} className="capitalize">
              {formatStatusText(r.status)} {r.delay_minutes ? `${r.delay_minutes} mnt` : ""}
            </StatusPill>
          </div>
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm transition-opacity">
          <img src={preview} alt="selfie besar" className="max-h-[85vh] max-w-full rounded-3xl shadow-2xl border-4 border-white" />
        </div>
      )}
    </div>
  );
}
