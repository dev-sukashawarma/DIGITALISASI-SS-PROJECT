"use client";

import { useEffect, useState } from "react";
import { Avatar, StatusPill, EmptyState, Spinner } from "@suka/design-system";
import { LogIn, LogOut, Clock4, MoreHorizontal, Users, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from '@suka/auth';
import { computeBoard, type BoardStaff, type BoardRecord, type BoardRow } from "@/features/board/board";
import { PageHeader, InfoPill } from "@/components/PageHeader";
import { DashboardSettings } from "../DashboardSettings";

const PILL: Record<BoardRow["state"], { icon: React.ReactNode; label: (t: string | null) => string }> = {
  masuk:  { icon: <LogIn size={13} />,  label: (t, d) => `Masuk ${t}` },
  telat:  { icon: <Clock4 size={13} />, label: (t, d) => `Telat ${d ? d + ' mnt' : t}` },
  keluar: { icon: <LogOut size={13} />, label: (t, d) => `Keluar ${t}` },
  belum:  { icon: <MoreHorizontal size={13} />, label: () => "Belum hadir" },
  alpha:  { icon: <MoreHorizontal size={13} />, label: () => "Alpha" },
};

const SELFIE_BUCKET = "selfies";

const LEGEND = [
  { key: "hadir", label: "Hadir", dot: "bg-suka-green" },
  { key: "telat", label: "Telat", dot: "bg-amber-500" },
  { key: "belum", label: "Belum hadir", dot: "bg-gray-300" },
  { key: "alpha", label: "Alpha", dot: "bg-red-500" },
  { key: "total", label: "Total staf", dot: "bg-suka-brown" },
] as const;

export default function PapanKehadiranPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<ReturnType<typeof computeBoard> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  useEffect(() => {
    if (!outletStaff) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: staff }, { data: recs }, { data: cfg }] = await Promise.all([
        supabase.from("outlet_staff").select("id,name,role").eq("outlet_id", outletStaff.outlet_id).eq("status", "active"),
        supabase.from("attendance").select("outlet_staff_id,type,status,ts_server,selfie_url")
          .eq("outlet_id", outletStaff.outlet_id).gte("ts_server", `${today}T00:00:00`).lte("ts_server", `${today}T23:59:59`),
        supabase.from("outlet_attendance_config").select("jam_masuk,toleransi_menit").eq("outlet_id", outletStaff.outlet_id).single()
      ]);
      if (cfg) {
        setData(computeBoard((staff as BoardStaff[]) ?? [], (recs as BoardRecord[]) ?? [], cfg));
      }
    })();
  }, [outletStaff]);

  if (!data) return <div className="p-6 flex justify-center"><Spinner /></div>;

  const { summary } = data;
  const present = summary.hadir + summary.telat;
  const pct = summary.total > 0 ? Math.round((present / summary.total) * 100) : 0;
  const hadirPct = summary.total > 0 ? (summary.hadir / summary.total) * 100 : 0;
  const telatPct = summary.total > 0 ? (summary.telat / summary.total) * 100 : 0;
  const alphaPct = summary.total > 0 ? (summary.alpha / summary.total) * 100 : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Papan kehadiran"
        subtitle="Pantau kehadiran tim hari ini"
        action={
          <InfoPill icon={<CalendarDays size={14} />}>
            {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
          </InfoPill>
        }
      />

      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm text-gray-500">Kehadiran hari ini</span>
          <span className="text-2xl font-bold text-suka-ink">
            {pct}<span className="text-sm font-medium text-gray-400">%</span>
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-suka-gray-50">
          <div className="bg-suka-green transition-all duration-700" style={{ width: `${hadirPct}%` }} />
          <div className="bg-amber-500 transition-all duration-700" style={{ width: `${telatPct}%` }} />
          <div className="bg-red-500 transition-all duration-700" style={{ width: `${alphaPct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-5">
          {LEGEND.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${l.dot}`} />
              <span className="text-[13px] text-gray-500">{l.label}</span>
              <span className="ml-auto text-sm font-semibold text-suka-ink">{summary[l.key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-suka-ink">Daftar staf</span>
          <span className="text-xs text-gray-400">{data.rows.length} orang</span>
        </div>
        <div className="rounded-2xl border border-suka-gray-200 bg-white divide-y divide-suka-gray-200/70 overflow-hidden">
          {data.rows.length === 0 && <EmptyState icon={<Users size={28} />} title="Belum ada staff aktif" />}
          {data.rows.map((r) => {
            const p = PILL[r.state];
            return (
              <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
                {r.selfie_url ? (
                  <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                       className="h-10 w-10 shrink-0 cursor-pointer rounded-xl object-cover border border-suka-gray-200" />
                ) : (
                  <Avatar name={r.name} size={38} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-suka-ink">{r.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{r.role}</div>
                </div>
                <StatusPill kind={r.state} className="whitespace-nowrap">{p.icon}{p.label(r.time, r.delay_minutes)}</StatusPill>
              </div>
            );
          })}
        </div>
      </div>

      <DashboardSettings />

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm transition-opacity">
          <img src={preview} alt="selfie besar" className="max-h-[85vh] max-w-full rounded-3xl shadow-2xl border-4 border-white" />
        </div>
      )}
    </div>
  );
}
