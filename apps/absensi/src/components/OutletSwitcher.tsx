"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Store } from "lucide-react";
import { Select } from "@/components/Select";

type Outlet = { id: string; name: string };

export function OutletSwitcher({ currentOutletId, onChange }: { currentOutletId: string, onChange: (id: string) => void }) {
  const supabase = createClient();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // 1. Get accessible IDs
      const { data: rpcData, error } = await supabase.rpc("accessible_outlet_ids");
      if (error) {
        if (mounted) setLoading(false);
        return;
      }
      
      const ids = rpcData?.map((r: any) => typeof r === 'string' ? r : r.accessible_outlet_ids) || [];
      
      // 2. Fetch outlet details
      if (ids.length > 0) {
        const { data } = await supabase
          .from("outlets")
          .select("id, name")
          .in("id", ids)
          .order("name");
        if (data && mounted) {
          setOutlets(data);
          if (!currentOutletId && data.length > 0) {
            onChange(data[0].id);
          }
        }
      }
      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [supabase, currentOutletId, onChange]);

  if (loading || outlets.length <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-xl border border-gray-200 p-4 mb-5 shadow-sm gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
        <Store size={18} className="text-suka-orange" />
        Pilih Outlet Enrollment:
      </div>
      <div className="w-full sm:w-64">
        <Select
          value={currentOutletId}
          onChange={val => onChange(val)}
          options={outlets.map(o => ({ label: o.name, value: o.id }))}
          className="w-full"
        />
      </div>
    </div>
  );
}
