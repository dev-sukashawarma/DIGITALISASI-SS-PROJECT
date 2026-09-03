import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { InboundOutbound } from '@/types/stok';

/**
 * Baris mentah dari view `inbound_outbound_feed` (flat, tanpa embed PostgREST).
 * View-nya diturunkan langsung dari `ledger_stok`, jadi selalu ikut pergerakan
 * stok terbaru -- beda dengan tabel `inbound_outbound` lama yang cuma pernah
 * diisi sekali lewat script backfill dan beku sejak 21 Agustus 2026.
 */
interface FeedRow {
  id: string;
  outlet_id: string;
  bahan_baku_id: string;
  tipe: 'IN' | 'OUT';
  sumber: 'vendor_po' | 'vendor_manual' | 'kirim_outlet';
  kategori: string;
  qty: number;
  harga_satuan: number | null;
  catatan: string | null;
  created_by: string | null;
  created_at: string;
  pencatat_nama: string | null;
  bahan_nama: string;
  bahan_satuan: string;
  satuan_tengah: string | null;
  faktor_tengah: number | null;
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
  satuan_distribusi: string | null;
  ref_shipment_id: string | null;
  tujuan_outlet_nama: string | null;
  nomor_sj: string | null;
  nomor_po: string | null;
  supplier_nama: string | null;
}

const FEED_COLUMNS = `
  id, outlet_id, bahan_baku_id, tipe, sumber, kategori, qty, harga_satuan,
  catatan, created_by, created_at, pencatat_nama,
  bahan_nama, bahan_satuan, satuan_tengah, faktor_tengah, satuan_kecil,
  faktor_tampilan, satuan_distribusi,
  ref_shipment_id, tujuan_outlet_nama, nomor_sj, nomor_po, supplier_nama
`;

/** Bentuk ulang baris flat jadi struktur bersarang yang dipakai komponen list. */
function toInboundOutbound(row: FeedRow): InboundOutbound {
  return {
    id: row.id,
    outlet_id: row.outlet_id,
    bahan_baku_id: row.bahan_baku_id,
    tipe: row.tipe,
    sumber: row.sumber,
    kategori: row.kategori,
    qty: row.qty,
    harga_satuan: row.harga_satuan,
    catatan: row.catatan,
    created_by: row.created_by,
    created_at: row.created_at,
    ref_shipment_id: row.ref_shipment_id,
    tujuan_outlet_nama: row.tujuan_outlet_nama,
    nomor_sj: row.nomor_sj,
    nomor_po: row.nomor_po,
    supplier_nama: row.supplier_nama,
    bahan_baku: {
      nama: row.bahan_nama,
      satuan: row.bahan_satuan,
      satuan_tengah: row.satuan_tengah,
      faktor_tengah: row.faktor_tengah,
      satuan_kecil: row.satuan_kecil,
      faktor_tampilan: row.faktor_tampilan,
      satuan_distribusi: row.satuan_distribusi,
    },
    outlet_staff: row.pencatat_nama ? { name: row.pencatat_nama } : null,
  };
}

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
        .from('inbound_outbound_feed')
        .select(FEED_COLUMNS)
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

      let rows = ((result as unknown as FeedRow[]) || []).map(toInboundOutbound);

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        rows = rows.filter(
          (item) =>
            item.bahan_baku?.nama.toLowerCase().includes(q) ||
            item.kategori.toLowerCase().includes(q) ||
            item.catatan?.toLowerCase().includes(q) ||
            item.tujuan_outlet_nama?.toLowerCase().includes(q) ||
            item.nomor_sj?.toLowerCase().includes(q) ||
            item.nomor_po?.toLowerCase().includes(q) ||
            item.supplier_nama?.toLowerCase().includes(q)
        );
      }

      setData(rows);
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
