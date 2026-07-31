"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Store } from "lucide-react";
import { Select } from "@/components/Select";
import { useAuth } from '@suka/auth';

type Outlet = { id: string; name: string };

export function OutletSwitcher({ currentOutletId, onChange }: { currentOutletId: string, onChange: (id: string) => void }) {
  const supabase = createClient();
  const { outletStaff } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const isSpv = outletStaff?.role === 'spv' || outletStaff?.role === 'admin' || outletStaff?.role === 'regional_manager';
      let ids: string[] = [];
      
      if (!isSpv) {
        // 1. Get accessible IDs
        const { data: rpcData, error } = await supabase.rpc("accessible_outlet_ids");
        if (error) {
          if (mounted) setLoading(false);
          return;
        }
        ids = rpcData?.map((r: any) => typeof r === 'string' ? r : r.accessible_outlet_ids) || [];
      }

      // 2. Fetch outlet details
      if (isSpv || ids.length > 0) {
        let query = supabase.from("outlets").select("id, name").neq("id", "00000000-0000-0000-0000-000000000000").order("name");
        if (!isSpv && ids.length > 0) {
          query = query.in("id", ids);
        }
        const { data } = await query;
        
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
  }, [supabase, currentOutletId, onChange, outletStaff]);

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
          searchable
        />
      </div>
    </div>
  );
}
