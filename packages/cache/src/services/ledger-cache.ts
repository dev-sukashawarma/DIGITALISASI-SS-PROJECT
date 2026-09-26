import { defaultCacheManager, CacheManager } from '../cache-manager';
import { CACHE_TTL } from '../types';

export interface LedgerCacheServices {
  getCachedLedgerTransaksi: (
    supabase: any,
    outletId: string,
    page?: number,
    forceRefresh?: boolean
  ) => Promise<any[]>;
  invalidateLedgerCache: (outletId?: string) => Promise<void>;
}

export const LEDGER_CACHE_KEYS = {
  OUTLET_PAGE: (outletId: string, page: number) => `suka:ledger:outlet:${outletId}:p${page}`,
  OUTLET_ALL: (outletId: string) => `suka:ledger:outlet:${outletId}:*`,
  ALL: 'suka:ledger:outlet:*',
};

const PAGE_SIZE = 50;

/**
 * Creates domain-specific ledger cached accessors.
 */
export function createLedgerCacheServices(manager: CacheManager = defaultCacheManager): LedgerCacheServices {
  return {
    /**
     * Retrieves ledger summary for an outlet.
     * Page 0 is smart-cached in L1/L2 Redis with 60s TTL.
     * Subsequent pages (historical records) bypass cache to preserve memory.
     */
    async getCachedLedgerTransaksi(
      supabase: any,
      outletId: string,
      page = 0,
      forceRefresh = false
    ): Promise<any[]> {
      const cacheKey = LEDGER_CACHE_KEYS.OUTLET_PAGE(outletId, page);

      // Force refresh purges this outlet's page cache immediately
      if (forceRefresh) {
        await manager.invalidate(cacheKey);
      }

      // Historical pages (page > 0) are fetched directly from DB
      if (page > 0) {
        return fetchFromSupabase(supabase, outletId, page);
      }

      // Page 0 uses Smart Tiered Cache
      return manager.getCached(
        cacheKey,
        async () => fetchFromSupabase(supabase, outletId, 0),
        {
          ttlSeconds: CACHE_TTL.SHORT, // 60 seconds
          skipL1: forceRefresh,
          skipL2: forceRefresh,
        }
      );
    },

    /**
     * Instantly purges cache when new transaction / order / opname / waste occurs.
     */
    async invalidateLedgerCache(outletId?: string): Promise<void> {
      const pattern = outletId ? LEDGER_CACHE_KEYS.OUTLET_ALL(outletId) : LEDGER_CACHE_KEYS.ALL;
      await manager.invalidate(pattern);
      console.info(`[LedgerCache] Smart-cache purged for ${outletId || 'all outlets'}`);
    },
  };
}

/**
 * Helper to execute the query + enrichment from Supabase PostgREST
 */
async function fetchFromSupabase(supabase: any, outletId: string, page: number): Promise<any[]> {
  const offset = page * PAGE_SIZE;

  // Menggunakan RPC ledger_transaksi_page (migration 20260922160000)
  // Menghindari full table scan / GROUP BY di view ledger_transaksi_ringkas (4.2s -> 168ms, 0 byte spill)
  const { data: rows, error: err } = await supabase.rpc('ledger_transaksi_page', {
    p_outlet: outletId,
    p_offset: offset,
    p_limit: PAGE_SIZE,
  });

  if (err) throw err;

  let summaries: any[] = rows || [];

  // For page 0, append pending waste reports if any
  if (page === 0) {
    try {
      const { data: pendingWastes } = await supabase
        .from('stok_waste_reports')
        .select('id, created_at, bahan_baku_id, qty, reason')
        .eq('outlet_id', outletId)
        .eq('status', 'PENDING');

      if (pendingWastes && pendingWastes.length > 0) {
        const wasteSummaries = pendingWastes.map((w: any) => ({
          transaksi_key: `waste_pending_${w.id}`,
          outlet_id: outletId,
          created_at: w.created_at,
          jumlah_bahan: 1,
          ref_order_id: null,
          ref_opname_id: null,
          ref_shipment_id: null,
          ref_transfer_id: null,
          single_bahan_baku_id: w.bahan_baku_id,
          single_tipe: 'waste_pending',
          single_qty: -w.qty,
          single_catatan: w.reason,
          single_saldo_sesudah: null,
        }));

        summaries = [...wasteSummaries, ...summaries].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch {
      // Pending waste is complementary, continue if table inaccessible
    }
  }

  // Batch enrichment for order numbers, opname dates, and transfer destinations
  const orderIds = [...new Set(summaries.map((s) => s.ref_order_id).filter(Boolean))];
  const opnameIds = [...new Set(summaries.map((s) => s.ref_opname_id).filter(Boolean))];
  const shipmentIds = [...new Set(summaries.map((s) => s.ref_shipment_id).filter(Boolean))];

  const [ordersRes, opnameRes, shipmentRes] = await Promise.all([
    orderIds.length
      ? supabase.from('orders').select('id, order_number, order_items(menu_item_name)').in('id', orderIds)
      : Promise.resolve({ data: [] }),
    opnameIds.length
      ? supabase.from('opname').select('id, tanggal, tipe').in('id', opnameIds)
      : Promise.resolve({ data: [] }),
    shipmentIds.length
      ? supabase.from('surat_jalan').select('id, outlets(name)').in('id', shipmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  interface OrderMeta { order_number?: number; order_items_names?: string | null }
  interface OpnameMeta { opname_tanggal?: string; opname_tipe?: string }
  interface ShipmentMeta { tujuan_outlet_nama?: string | null }

  const orderMap = new Map<string, OrderMeta>((ordersRes.data || []).map((o: any) => [
    o.id,
    {
      order_number: o.order_number,
      order_items_names: (o.order_items || []).map((i: any) => i.menu_item_name).filter(Boolean).join(', ') || null,
    },
  ]));

  const opnameMap = new Map<string, OpnameMeta>((opnameRes.data || []).map((o: any) => [
    o.id,
    { opname_tanggal: o.tanggal, opname_tipe: o.tipe },
  ]));

  const shipmentMap = new Map<string, ShipmentMeta>((shipmentRes.data || []).map((s: any) => [
    s.id,
    { tujuan_outlet_nama: s.outlets?.name ?? null },
  ]));

  return summaries.map((s) => {
    const o = s.ref_order_id ? orderMap.get(s.ref_order_id) : undefined;
    const op = s.ref_opname_id ? opnameMap.get(s.ref_opname_id) : undefined;
    const sh = s.ref_shipment_id ? shipmentMap.get(s.ref_shipment_id) : undefined;

    return {
      ...s,
      order_number: o?.order_number ?? null,
      order_items_names: o?.order_items_names ?? null,
      opname_tanggal: op?.opname_tanggal ?? null,
      opname_tipe: op?.opname_tipe ?? null,
      shipment_dest_outlet_name: sh?.tujuan_outlet_nama ?? null,
      tujuan_outlet_nama: sh?.tujuan_outlet_nama ?? null,
    };
  });
}

export const ledgerCacheServices = createLedgerCacheServices(defaultCacheManager);

export const {
  getCachedLedgerTransaksi,
  invalidateLedgerCache,
} = ledgerCacheServices;
