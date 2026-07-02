"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { LogIn, LogOut, CalendarDays, ClipboardList, Download } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { PageHeader } from "@/components/PageHeader";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
  delay_minutes?: number | null;
};

const SELFIE_BUCKET = "selfies";

function calculateDelayMinutes(tsServer: string, jamMasuk: string): number {
  const [h, m] = jamMasuk.split(":").map(Number);
  const serverTime = new Date(tsServer);
  
  const expectedTime = new Date(tsServer);
  expectedTime.setHours(h, m, 0, 0);
  
  const diffMs = serverTime.getTime() - expectedTime.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  const { data: rows = [] } = useQuery({
    queryKey: ["rekap", outletStaff?.outlet_id, date],
    enabled: !!outletStaff?.outlet_id,
    queryFn: async () => {
      const [attRes, staffRes, cfgRes] = await Promise.all([
        // Tanpa embed `outlet_staff(name)`: JOIN itu ikut tunduk RLS tabel outlet_staff —
        // kalau baris staff pemilik attendance tak lolos RLS untuk di-JOIN, PostgREST
        // membuang SELURUH baris attendance itu (bukan cuma nama-nya kosong). Efeknya
        // orang yang sudah absen (terlihat "Masuk" di papan kehadiran) muncul "Alpha" di
        // sini. Nama digabung manual dari query outlet_staff terpisah di bawah — pola yang
        // sama dipakai papan-kehadiran dan sudah terbukti tak kena masalah ini.
        supabase
          .from("attendance")
          .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff_id")
          .eq("outlet_id", outletStaff!.outlet_id)
          .gte("ts_server", `${date}T00:00:00`)
          .lte("ts_server", `${date}T23:59:59`)
          .order("ts_server", { ascending: false }),
        supabase
          .from("outlet_staff")
          .select("id,name")
          .eq("outlet_id", outletStaff!.outlet_id)
          .eq("status", "active"),
        supabase
          .from("outlet_attendance_config")
          .select("jam_masuk,jam_keluar")
          .eq("outlet_id", outletStaff!.outlet_id)
          .single()
      ]);

      const activeStaff = staffRes.data || [];
      const nameById = new Map(activeStaff.map((s) => [s.id, s.name]));
      const rawRows = (attRes.data as unknown as (Omit<Row, "outlet_staff"> & { outlet_staff_id: string })[]) || [];
      const dbRows: (Row & { outlet_staff_id: string })[] = rawRows.map((r) => ({
        ...r,
        outlet_staff: { name: nameById.get(r.outlet_staff_id) ?? "-" },
      }));
      const cfg = cfgRes.data;

      dbRows.forEach(r => {
        if (r.status === "telat" && r.type === "in" && cfg?.jam_masuk) {
          r.delay_minutes = calculateDelayMinutes(r.ts_server, cfg.jam_masuk);
        }
        if (r.status === "pulang_telat" && r.type === "out" && cfg?.jam_keluar) {
          r.delay_minutes = calculateDelayMinutes(r.ts_server, cfg.jam_keluar);
        }
        if (r.status === "lebih_awal" && r.type === "out" && cfg?.jam_keluar) {
          r.delay_minutes = Math.abs(calculateDelayMinutes(r.ts_server, cfg.jam_keluar));
        }
      });

      const inRecords = new Set(dbRows.filter(r => r.type === "in").map(r => r.outlet_staff_id));
      const virtualAlphas: Row[] = activeStaff
        .filter(staff => !inRecords.has(staff.id))
        .map(staff => ({
          id: `virtual-alpha-${staff.id}`,
          type: "in" as const,
          ts_server: `${date}T23:59:59`,
          ts_client: null,
          status: "alpha" as const,
          selfie_url: null,
          outlet_staff: { name: staff.name },
        }));

      return [...dbRows, ...virtualAlphas];
    },
  });

  const summary = useMemo(() => ({
    tepat: rows.filter((r) => r.status === "tepat").length,
    telat: rows.filter((r) => r.status === "telat" || r.status === "pulang_telat").length,
    alpha: rows.filter((r) => r.status === "alpha").length,
    lebih_awal: rows.filter((r) => r.status === "lebih_awal").length,
  }), [rows]);

  const filteredRows = rows.filter(r => filterStatus === "semua" || r.status === filterStatus);

  function jam(ts: string) {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function exportCsv() {
    const data: CsvRow[] = rows.map((r) => ({
      name: r.outlet_staff?.name ?? "-",
      type: r.type,
      jam: r.status === "alpha" ? "-" : jam(r.ts_server),
      status: r.status,
    }));
    downloadCsv(`rekap-${date}.csv`, attendanceToCsv(data));
  }

  const STAT = [
    { label: "Tepat", value: summary.tepat, cls: "text-suka-green" },
    { label: "Telat", value: summary.telat, cls: "text-[#854f0b]" },
    { label: "Alpha", value: summary.alpha, cls: "text-red-600" },
    { label: "Awal", value: summary.lebih_awal, cls: "text-[#0369a1]" },
  ];

  return (
    <div className="space-y-5">
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
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs bg-white border border-suka-gray-300 rounded-lg px-2 py-1.5 outline-none text-gray-600"
        >
          <option value="semua">Semua Status</option>
          <option value="tepat">Tepat</option>
          <option value="telat">Masuk Telat</option>
          <option value="alpha">Alpha</option>
          <option value="lebih_awal">Pulang Lebih Awal</option>
          <option value="pulang_telat">Pulang Telat</option>
        </select>
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
              {r.status} {r.delay_minutes ? `${r.delay_minutes} mnt` : ""}
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
