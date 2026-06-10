"use client";

import { useEffect, useState } from "react";
import { Avatar, StatusPill, EmptyState, Spinner } from "@suka/design-system";
import { LogIn, LogOut, Clock4, MoreHorizontal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { computeBoard, type BoardStaff, type BoardRecord, type BoardRow } from "@/features/board/board";

const PILL: Record<BoardRow["state"], { icon: React.ReactNode; label: (t: string | null) => string }> = {
  masuk:  { icon: <LogIn size={13} />,  label: (t) => `Masuk ${t}` },
  telat:  { icon: <Clock4 size={13} />, label: (t) => `Telat ${t}` },
  keluar: { icon: <LogOut size={13} />, label: (t) => `Keluar ${t}` },
  belum:  { icon: <MoreHorizontal size={13} />, label: () => "Belum hadir" },
};

export default function DashboardPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<ReturnType<typeof computeBoard> | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: staff }, { data: recs }] = await Promise.all([
        supabase.from("outlet_staff").select("id,name,role").eq("outlet_id", outletStaff.outlet_id).eq("status", "active"),
        supabase.from("attendance").select("outlet_staff_id,type,status,ts_server")
          .eq("outlet_id", outletStaff.outlet_id).gte("ts_server", `${today}T00:00:00`).lte("ts_server", `${today}T23:59:59`),
      ]);
      setData(computeBoard((staff as BoardStaff[]) ?? [], (recs as BoardRecord[]) ?? []));
    })();
  }, [outletStaff]);

  if (!data) return <div className="p-6 flex justify-center"><Spinner /></div>;

  const cards = [
    { label: "Hadir", value: data.summary.hadir, color: "text-suka-green" },
    { label: "Telat", value: data.summary.telat, color: "text-[#854f0b]" },
    { label: "Belum hadir", value: data.summary.belum, color: "text-red-600" },
    { label: "Total staff", value: data.summary.total, color: "text-suka-ink" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-suka-brown">Papan kehadiran</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {data.rows.length === 0 && <EmptyState icon={<Users size={28} />} title="Belum ada staff aktif" />}
        {data.rows.map((r) => {
          const p = PILL[r.state];
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={r.name} size={34} />
              <div className="flex-1">
                <div className="text-sm font-medium text-suka-ink">{r.name}</div>
                <div className="text-xs text-gray-500 capitalize">{r.role}</div>
              </div>
              <StatusPill kind={r.state}>{p.icon}{p.label(r.time)}</StatusPill>
            </div>
          );
        })}
      </div>
    </div>
  );
}
