"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { LogIn, LogOut, CalendarDays, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { PageHeader } from "@/components/PageHeader";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha";
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
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!outletStaff) return;

    Promise.all([
      supabase
        .from("attendance")
        .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff_id,outlet_staff(name)")
        .eq("outlet_id", outletStaff.outlet_id)
        .gte("ts_server", `${date}T00:00:00`)
        .lte("ts_server", `${date}T23:59:59`)
        .order("ts_server", { ascending: false }),
      supabase
        .from("outlet_staff")
        .select("id,name")
        .eq("outlet_id", outletStaff.outlet_id)
        .eq("status", "active"),
      supabase
        .from("outlet_attendance_config")
        .select("jam_masuk")
        .eq("outlet_id", outletStaff.outlet_id)
        .single()
    ]).then(([attRes, staffRes, cfgRes]) => {
      const dbRows = (attRes.data as unknown as (Row & { outlet_staff_id: string })[]) || [];
      const activeStaff = staffRes.data || [];
      const cfg = cfgRes.data;

      // Calculate delay minutes for telat records
      dbRows.forEach(r => {
        if (r.status === "telat" && r.type === "in" && cfg?.jam_masuk) {
          r.delay_minutes = calculateDelayMinutes(r.ts_server, cfg.jam_masuk);
        }
      });

      const inRecords = new Set(dbRows.filter(r => r.type === "in").map(r => r.outlet_staff_id));

      const virtualAlphas: Row[] = [];

      // Staf tanpa absen masuk langsung ditampilkan sebagai Alpha agar real-time.
      activeStaff.forEach(staff => {
        if (!inRecords.has(staff.id)) {
          virtualAlphas.push({
            id: `virtual-alpha-${staff.id}`,
            type: "in",
            ts_server: `${date}T23:59:59`, // Dummy time
            ts_client: null,
            status: "alpha",
            selfie_url: null,
            outlet_staff: { name: staff.name }
          });
        }
      });

      setRows([...dbRows, ...virtualAlphas]);
    });
  }, [outletStaff, date]);

  const summary = useMemo(() => ({
    tepat: rows.filter((r) => r.status === "tepat").length,
    telat: rows.filter((r) => r.status === "telat").length,
    alpha: rows.filter((r) => r.status === "alpha").length,
  }), [rows]);

  function jam(ts: string) {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const STAT = [
    { label: "Tepat", value: summary.tepat, cls: "text-suka-green" },
    { label: "Telat", value: summary.telat, cls: "text-[#854f0b]" },
    { label: "Alpha", value: summary.alpha, cls: "text-red-600" },
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

      <div className="divide-y divide-suka-gray-200/70 overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
        {rows.length === 0 && <EmptyState icon={<ClipboardList size={28} />} title="Belum ada data" description="Tidak ada absensi untuk tanggal ini." />}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
            {r.selfie_url ? (
              <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                   className="h-10 w-10 shrink-0 cursor-pointer rounded-xl object-cover" />
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
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6">
          <img src={preview} alt="selfie besar" className="max-h-[80vh] max-w-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
