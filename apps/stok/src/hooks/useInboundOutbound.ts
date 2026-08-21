import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { InboundOutbound } from '@/types/stok';

export function useInboundOutbound(
  outletId?: string, 
  page: number = 0, 
  searchQuery?: string,
  startDate?: string,
  endDate?: string
) {
  const [data, setData] = useState<InboundOutbound[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const pageSize = 100;

  const refresh = async () => {
    if (!outletId) return;
    
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      let query = supabase
        .from('inbound_outbound')
        .select(`
          *,
          bahan_baku:bahan_baku_id(
            nama, 
            satuan, 
            satuan_tengah, 
            faktor_tengah, 
            satuan_kecil, 
            faktor_tampilan, 
            satuan_distribusi,
            bahan_baku_harga(harga_beli_display, harga_beli)
          ),
          outlet_staff:created_by(name)
        `)
        .eq('outlet_id', outletId);

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const { data: result, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;

      let filteredResult = (result as InboundOutbound[]) || [];
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filteredResult = filteredResult.filter(
          item => 
            item.bahan_baku?.nama.toLowerCase().includes(q) || 
            item.kategori.toLowerCase().includes(q) ||
            item.catatan?.toLowerCase().includes(q)
        );
      }

      setData(filteredResult);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data mutasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (outletId) {
      refresh();
    }
  }, [outletId, page, searchQuery, startDate, endDate]);

  return { data, loading, error, refresh };
}
