"use client";

import { useEffect, useState } from "react";
import { Badge, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
};

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!outletStaff) return;
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    supabase
      .from("attendance")
      .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff(name)")
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", start)
      .lte("ts_server", end)
      .order("ts_server", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [outletStaff, date]);

  const statusVariant = {
    tepat: "success",
    telat: "warning",
    alpha: "error"
  } as const;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Rekap Kehadiran</h1>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border rounded p-2"
      />
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.outlet_staff?.name}</p>
                <p className="text-sm text-gray-500">
                  {r.type} · {new Date(r.ts_server).toLocaleTimeString("id-ID")}
                </p>
              </div>
              <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-gray-500">Belum ada data untuk tanggal ini.</p>
        )}
      </div>
    </div>
  );
}
