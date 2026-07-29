'use server';

import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/authz';
import { getParser, PLATFORM_COMPARE_CHANNEL } from '@/lib/platformSettlement';
import type { PlatformId, SettlementDaily, SettlementRow } from '@/lib/platformSettlement';
import storeMapRaw from '@/data/platform_store_map.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type StoreMapEntry = {
  byStoreId: Record<string, string>;
  byName: Record<string, string>;
  closed: Record<string, string>;
};
const storeMap = storeMapRaw as unknown as Record<string, StoreMapEntry>;

export interface OutletComparison {
  outletId: string;
  outletName: string;
  storeNames: string[];
  trxCount: number;
  omzetKotor: number;
  promoMerchant: number;
  commission: number;
  /** Omzet food apps versi sistem kita (SEMUA platform) untuk rentang yang sama. */
  sistemOmzetKotor: number;
  sistemTrxCount: number;
}

export async function previewSettlementFile(formData: FormData) {
  try {
    await requireRole(['admin', 'owner']);

    const platform = String(formData.get('platform') ?? '');
    const file = formData.get('file') as File | null;
    if (!file) return { success: false as const, error: 'File belum dipilih.' };

    const parser = getParser(platform);
    const rows: SettlementRow[] = parser.parse(await file.arrayBuffer());

    // --- Pemetaan toko platform -> outlet kita ---
    const map = storeMap[platform] ?? { byStoreId: {}, byName: {}, closed: {} };

    const { data: outletsData, error: outletsErr } = await supabase
      .from('outlets')
      .select('id, name');
    if (outletsErr) return { success: false as const, error: `Gagal memuat outlet: ${outletsErr.message}` };
    const outletIdByName = new Map<string, string>(
      (outletsData ?? []).map((o) => [String(o.name).trim().toLowerCase(), o.id as string])
    );

    const unmapped = new Map<string, { storeId: string; storeName: string; omzetKotor: number }>();
    const skippedClosed = new Map<string, { storeId: string; storeName: string; omzetKotor: number }>();

    // Agregasi per (outlet, tanggal) — inilah bentuk yang disimpan ke DB.
    const dailyMap = new Map<string, SettlementDaily>();
    const storeNamesByOutlet = new Map<string, Set<string>>();

    for (const r of rows) {
      if (map.closed[r.storeId]) {
        const cur = skippedClosed.get(r.storeId) ?? { storeId: r.storeId, storeName: r.storeName, omzetKotor: 0 };
        cur.omzetKotor += r.omzetKotor;
        skippedClosed.set(r.storeId, cur);
        continue;
      }

      const outletName = map.byStoreId[r.storeId] ?? map.byName[r.storeName.trim().toLowerCase()] ?? null;
      const outletId = outletName ? outletIdByName.get(outletName.trim().toLowerCase()) ?? null : null;

      if (!outletId) {
        const key = r.storeId || r.storeName;
        const cur = unmapped.get(key) ?? { storeId: r.storeId, storeName: r.storeName, omzetKotor: 0 };
        cur.omzetKotor += r.omzetKotor;
        unmapped.set(key, cur);
        continue;
      }

      if (!storeNamesByOutlet.has(outletId)) storeNamesByOutlet.set(outletId, new Set());
      storeNamesByOutlet.get(outletId)!.add(r.storeName);

      const key = `${outletId}|${r.date}`;
      const existing = dailyMap.get(key);
      if (existing) {
        existing.omzetKotor += r.omzetKotor;
        existing.promoMerchant += r.promoMerchant;
        existing.commission += r.commission;
        existing.trxCount += 1;
      } else {
        dailyMap.set(key, {
          storeId: r.storeId,
          storeName: r.storeName,
          outletName,
          outletId,
          date: r.date,
          omzetKotor: r.omzetKotor,
          promoMerchant: r.promoMerchant,
          commission: r.commission,
          trxCount: 1,
        });
      }
    }

    const daily = [...dailyMap.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.outletName ?? '').localeCompare(b.outletName ?? '')
    );

    if (daily.length === 0) {
      return {
        success: false as const,
        error: 'Tidak ada baris yang bisa dipetakan ke outlet mana pun.',
        unmappedStores: [...unmapped.values()],
        skippedClosed: [...skippedClosed.values()],
      };
    }

    const dates = daily.map((d) => d.date).sort();
    const periodeFrom = dates[0];
    const periodeTo = dates[dates.length - 1];

    // --- Pembanding: omzet food apps versi sistem kita untuk rentang yang sama ---
    const compareChannel = PLATFORM_COMPARE_CHANNEL[platform as PlatformId] ?? 'food_apps';
    const sistemByOutlet = new Map<string, { omzet: number; trx: number }>();
    const { data: sistemData, error: sistemErr } = await supabase.rpc('channel_gross_by_outlet', {
      p_from: periodeFrom,
      p_to: periodeTo,
      p_channel: compareChannel,
    });
    if (sistemErr) {
      // Pembanding bersifat informatif — kalau gagal, import tetap boleh jalan.
      console.error('channel_gross_by_outlet gagal:', sistemErr.message);
    } else {
      for (const row of (sistemData ?? []) as any[]) {
        sistemByOutlet.set(row.outlet_id, {
          omzet: Number(row.omzet_kotor) || 0,
          trx: Number(row.trx_count) || 0,
        });
      }
    }

    const perOutletMap = new Map<string, OutletComparison>();
    for (const d of daily) {
      const id = d.outletId!;
      const cur = perOutletMap.get(id) ?? {
        outletId: id,
        outletName: d.outletName ?? '-',
        storeNames: [...(storeNamesByOutlet.get(id) ?? [])],
        trxCount: 0,
        omzetKotor: 0,
        promoMerchant: 0,
        commission: 0,
        sistemOmzetKotor: sistemByOutlet.get(id)?.omzet ?? 0,
        sistemTrxCount: sistemByOutlet.get(id)?.trx ?? 0,
      };
      cur.trxCount += d.trxCount;
      cur.omzetKotor += d.omzetKotor;
      cur.promoMerchant += d.promoMerchant;
      cur.commission += d.commission;
      perOutletMap.set(id, cur);
    }
    const perOutlet = [...perOutletMap.values()].sort((a, b) => b.omzetKotor - a.omzetKotor);

    // Berapa baris yang akan tertimpa kalau file ini di-sync (re-upload periode sama).
    const { count: existingCount } = await supabase
      .from('platform_settlements')
      .select('id', { count: 'exact', head: true })
      .eq('platform', platform)
      .gte('tanggal', periodeFrom)
      .lte('tanggal', periodeTo);

    const totalOmzetKotor = perOutlet.reduce((s, o) => s + o.omzetKotor, 0);
    const totalCommission = perOutlet.reduce((s, o) => s + o.commission, 0);

    return {
      success: true as const,
      summary: {
        platform,
        platformLabel: parser.label,
        compareChannel,
        fileName: file.name,
        periodeFrom,
        periodeTo,
        totalTrx: rows.length,
        totalOmzetKotor,
        totalPromo: perOutlet.reduce((s, o) => s + o.promoMerchant, 0),
        totalCommission,
        commissionPct: totalOmzetKotor > 0 ? (totalCommission / totalOmzetKotor) * 100 : 0,
        rowsToWrite: daily.length,
        existingRows: existingCount ?? 0,
        perOutlet,
        unmappedStores: [...unmapped.values()],
        skippedClosed: [...skippedClosed.values()],
      },
      data: { platform, sourceFile: file.name, daily },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Terjadi kesalahan tak terduga.' };
  }
}

export async function syncSettlementData(payload: {
  platform: string;
  sourceFile: string;
  daily: SettlementDaily[];
}) {
  try {
    const { userId } = await requireRole(['admin', 'owner']);
    const { platform, sourceFile, daily } = payload;
    if (!daily?.length) return { success: false as const, error: 'Tidak ada data untuk disimpan.' };

    const records = daily
      .filter((d) => d.outletId)
      .map((d) => ({
        platform,
        outlet_id: d.outletId,
        tanggal: d.date,
        omzet_kotor: d.omzetKotor,
        promo_merchant: d.promoMerchant,
        commission: d.commission,
        trx_count: d.trxCount,
        source_file: sourceFile,
        imported_at: new Date().toISOString(),
        imported_by: userId,
      }));

    const BATCH = 500;
    for (let i = 0; i < records.length; i += BATCH) {
      const { error } = await supabase
        .from('platform_settlements')
        .upsert(records.slice(i, i + BATCH), { onConflict: 'platform,outlet_id,tanggal' });
      if (error) throw new Error(error.message);
    }

    return { success: true as const, savedRows: records.length };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Gagal menyimpan data.' };
  }
}
