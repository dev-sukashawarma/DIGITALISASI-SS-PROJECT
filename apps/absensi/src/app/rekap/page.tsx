"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { Download, LogIn, LogOut, CalendarDays, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
};

const SELFIE_BUCKET = "selfies";

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    supabase
      .from("attendance")
      .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff(name)")
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", `${date}T00:00:00`)
      .lte("ts_server", `${date}T23:59:59`)
      .order("ts_server", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
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

  function exportCsv() {
    const data: CsvRow[] = rows.map((r) => ({
      name: r.outlet_staff?.name ?? "-", type: r.type, jam: jam(r.ts_server), status: r.status,
    }));
    downloadCsv(`rekap-${date}.csv`, attendanceToCsv(data));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-suka-brown">Rekap kehadiran</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-suka-gray-300 px-2 py-1.5 text-sm text-gray-600">
            <CalendarDays size={15} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="outline-none" />
          </label>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-md bg-suka-brown px-3 py-1.5 text-sm font-medium text-white">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([["Tepat", summary.tepat, "text-suka-green"], ["Telat", summary.telat, "text-[#854f0b]"], ["Alpha", summary.alpha, "text-red-600"]] as const).map(([label, val, color]) => (
          <div key={label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {rows.length === 0 && <EmptyState icon={<ClipboardList size={28} />} title="Belum ada data" description="Tidak ada absensi untuk tanggal ini." />}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            {r.selfie_url ? (
              <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                   className="h-10 w-10 cursor-pointer rounded-md object-cover" />
            ) : <Avatar name={r.outlet_staff?.name ?? "?"} size={40} />}
            <div className="flex-1">
              <div className="text-sm font-medium text-suka-ink">{r.outlet_staff?.name ?? "-"}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {r.type === "in" ? <LogIn size={13} /> : <LogOut size={13} />}
                {r.type === "in" ? "Masuk" : "Keluar"} · {jam(r.ts_server)}
              </div>
            </div>
            <StatusPill kind={r.status}>{r.status}</StatusPill>
          </div>
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6">
          <img src={preview} alt="selfie besar" className="max-h-[80vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
