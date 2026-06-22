"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Store, ChevronDown } from "lucide-react";

type Outlet = { id: string; name: string };

export function OutletSwitcher({ currentOutletId, onChange }: { currentOutletId: string, onChange: (id: string) => void }) {
  const supabase = createClient();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. Get accessible IDs
      const { data: rpcData, error } = await supabase.rpc("accessible_outlet_ids");
      if (error) {
        setLoading(false);
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
        if (data) setOutlets(data);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading || outlets.length <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-xl border border-gray-200 p-4 mb-5 shadow-sm gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
        <Store size={18} className="text-suka-orange" />
        Pilih Outlet Enrollment:
      </div>
      <div className="relative w-full sm:w-auto">
        <select 
          value={currentOutletId}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full sm:w-64 bg-slate-50 border-2 border-gray-200 rounded-lg px-4 py-2 pr-10 font-bold text-suka-ink outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 transition-all cursor-pointer"
        >
          {outlets.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
