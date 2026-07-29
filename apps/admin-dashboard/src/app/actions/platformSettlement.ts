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

// ── Multi-platform preview ──────────────────────────────────────────────────
// Menerima hingga 4 file (satu per platform) + rentang tanggal manual dari user.
// Mengembalikan rekap gabungan seluruh platform vs Pawoon.

export interface MultiPlatformSummary {
  periodeFrom: string;
  periodeTo: string;
  totalOmzetKotor: number;
  totalAdminFee: number;
  totalPromo: number;
  totalTrx: number;
  pawoonOmzetKotor: number;
  pawoonTrxCount: number;
  perPlatform: {
    platform: string;
    label: string;
    fileName: string;
    omzetKotor: number;
    adminFee: number;
    promo: number;
    trx: number;
    rowsToWrite: number;
  }[];
  perOutlet: {
    outletId: string;
    outletName: string;
    omzetKotor: number;
    adminFee: number;
    promo: number;
    nettoCair: number;
    pawoonOmzet: number;
  }[];
  unmappedStores: { platform: string; storeId: string; storeName: string; omzetKotor: number }[];
  allDaily: { platform: string; sourceFile: string; daily: SettlementDaily[] }[];
}

const PLATFORM_LABELS: Record<string, string> = {
  shopeefood: 'ShopeeFood',
  grabfood: 'GrabFood',
  gofood: 'GoFood',
  tiktokgo: 'TikTok Go',
};

export async function previewAllSettlementFiles(formData: FormData): Promise<
  { success: true; summary: MultiPlatformSummary } | { success: false; error: string }
> {
  try {
    await requireRole(['admin', 'owner']);

    const periodeFrom = String(formData.get('from') ?? '');
    const periodeTo = String(formData.get('to') ?? '');
    if (!periodeFrom || !periodeTo) return { success: false, error: 'Periode belum dipilih.' };

    const outletIdsRaw = String(formData.get('outletIds') ?? '[]');
    const allowedOutletIds: string[] = JSON.parse(outletIdsRaw);
    if (allowedOutletIds.length === 0) return { success: false, error: 'Pilih minimal 1 outlet.' };

    const platformIds = ['shopeefood', 'grabfood', 'gofood', 'tiktokgo'];

    const { data: outletsData, error: outletsErr } = await supabase.from('outlets').select('id, name');
    if (outletsErr) return { success: false, error: `Gagal memuat outlet: ${outletsErr.message}` };
    const outletIdByName = new Map<string, string>(
      (outletsData ?? []).map((o) => [String(o.name).trim().toLowerCase(), o.id as string])
    );

    const outletOmzet = new Map<string, number>();
    const outletAdminFee = new Map<string, number>();
    const outletPromo = new Map<string, number>();
    const outletNames = new Map<string, string>();

    const perPlatform: MultiPlatformSummary['perPlatform'] = [];
    const unmappedStores: MultiPlatformSummary['unmappedStores'] = [];
    const allDaily: MultiPlatformSummary['allDaily'] = [];

    for (const platform of platformIds) {
      const file = formData.get(`file_${platform}`) as File | null;
      if (!file) continue;

      const map = storeMap[platform] ?? { byStoreId: {}, byName: {}, closed: {} };
      const parser = getParser(platform);
      const rows: SettlementRow[] = parser.parse(await file.arrayBuffer());

      const dailyMap = new Map<string, SettlementDaily>();

      for (const r of rows) {
        if (map.closed[r.storeId]) continue;
        const oName = map.byStoreId[r.storeId] ?? map.byName[r.storeName.trim().toLowerCase()] ?? null;
        const oId = oName ? outletIdByName.get(oName.trim().toLowerCase()) ?? null : null;
        if (!oId) {
          unmappedStores.push({ platform, storeId: r.storeId, storeName: r.storeName, omzetKotor: r.omzetKotor });
          continue;
        }
        // Filter hanya outlet yang dipilih user
        if (!allowedOutletIds.includes(oId)) continue;
        if (oName) outletNames.set(oId, oName);
        const key = `${oId}|${r.date}`;
        const ex = dailyMap.get(key);
        if (ex) {
          ex.omzetKotor += r.omzetKotor; ex.promoMerchant += r.promoMerchant;
          ex.commission += r.commission; ex.trxCount += 1;
        } else {
          dailyMap.set(key, {
            storeId: r.storeId, storeName: r.storeName, outletName: oName, outletId: oId,
            date: r.date, omzetKotor: r.omzetKotor, promoMerchant: r.promoMerchant,
            commission: r.commission, trxCount: 1,
          });
        }
      }

      const daily = [...dailyMap.values()];
      const pOmzet = daily.reduce((s, d) => s + d.omzetKotor, 0);
      const pFee = daily.reduce((s, d) => s + d.commission, 0);
      const pPromo = daily.reduce((s, d) => s + d.promoMerchant, 0);
      const pTrx = daily.reduce((s, d) => s + d.trxCount, 0);

      perPlatform.push({
        platform, label: PLATFORM_LABELS[platform] ?? platform, fileName: file.name,
        omzetKotor: pOmzet, adminFee: pFee, promo: pPromo, trx: pTrx, rowsToWrite: daily.length,
      });

      for (const d of daily) {
        const id = d.outletId!;
        outletOmzet.set(id, (outletOmzet.get(id) ?? 0) + d.omzetKotor);
        outletAdminFee.set(id, (outletAdminFee.get(id) ?? 0) + d.commission);
        outletPromo.set(id, (outletPromo.get(id) ?? 0) + d.promoMerchant);
      }
      allDaily.push({ platform, sourceFile: file.name, daily });
    }

    if (perPlatform.length === 0) return { success: false, error: 'Tidak ada file yang berhasil diproses.' };

    // Pembanding Pawoon — selalu ambil SEMUA channel food delivery (food apps + tiktok go)
    // karena omzet kotor Pawoon = gabungan keduanya, tidak dibedakan per platform
    const salesSources = ['grabfood', 'shopeefood', 'gofood', 'online', 'tiktok', 'tiktokgo'];

    const pawoonByOutlet = new Map<string, { omzet: number; trx: number }>();
    
    const settlementOutletIds = [...outletOmzet.keys()];
    let pawoonQ = supabase
      .from('sales_daily_spv')
      .select('outlet_id, sales_source, omzet, jumlah_order_completed')
      .gte('sales_date', periodeFrom)
      .lte('sales_date', periodeTo)
      .in('sales_source', salesSources)
      .in('outlet_id', settlementOutletIds);

    const { data: pawoonData } = await pawoonQ;
    for (const row of (pawoonData ?? []) as any[]) {
      const cur = pawoonByOutlet.get(row.outlet_id) ?? { omzet: 0, trx: 0 };
      cur.omzet += Number(row.omzet) || 0;
      cur.trx += Number(row.jumlah_order_completed) || 0;
      pawoonByOutlet.set(row.outlet_id, cur);
    }


    const allOutletIds = new Set([...outletOmzet.keys()]);
    const perOutlet: MultiPlatformSummary['perOutlet'] = [...allOutletIds].map((id) => {
      const omzet = outletOmzet.get(id) ?? 0;
      const adminFee = outletAdminFee.get(id) ?? 0;
      const promo = outletPromo.get(id) ?? 0;
      const nettoCair = omzet - adminFee - promo;
      const pawoon = pawoonByOutlet.get(id)?.omzet ?? 0;

      return {
        outletId: id, outletName: outletNames.get(id) ?? id,
        omzetKotor: omzet, adminFee, promo, nettoCair, pawoonOmzet: pawoon
      };
    }).sort((a, b) => b.omzetKotor - a.omzetKotor);

    return {
      success: true,
      summary: {
        periodeFrom, periodeTo,
        totalOmzetKotor: perPlatform.reduce((s, p) => s + p.omzetKotor, 0),
        totalAdminFee: perPlatform.reduce((s, p) => s + p.adminFee, 0),
        totalPromo: perPlatform.reduce((s, p) => s + p.promo, 0),
        totalTrx: perPlatform.reduce((s, p) => s + p.trx, 0),
        pawoonOmzetKotor: [...pawoonByOutlet.values()].reduce((s, v) => s + v.omzet, 0),
        pawoonTrxCount: [...pawoonByOutlet.values()].reduce((s, v) => s + v.trx, 0),
        perPlatform, perOutlet, unmappedStores, allDaily,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Terjadi kesalahan tak terduga.' };
  }
}

export async function syncAllSettlementData(allDaily: MultiPlatformSummary['allDaily']) {
  try {
    const { userId } = await requireRole(['admin', 'owner']);
    let totalSaved = 0;
    for (const { platform, sourceFile, daily } of allDaily) {
      const records = daily.filter((d) => d.outletId).map((d) => ({
        platform, outlet_id: d.outletId, tanggal: d.date,
        omzet_kotor: d.omzetKotor, promo_merchant: d.promoMerchant,
        commission: d.commission, trx_count: d.trxCount,
        source_file: sourceFile, imported_at: new Date().toISOString(), imported_by: userId,
      }));
      const BATCH = 500;
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await supabase
          .from('platform_settlements')
          .upsert(records.slice(i, i + BATCH), { onConflict: 'platform,outlet_id,tanggal' });
        if (error) throw new Error(error.message);
      }
      totalSaved += records.length;
    }
    return { success: true as const, savedRows: totalSaved };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Gagal menyimpan data.' };
  }
}
