'use server';

import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/authz';
import { getParser, PLATFORM_COMPARE_CHANNEL } from '@/lib/platformSettlement';
import type { PlatformId, SettlementDaily, SettlementRow } from '@/lib/platformSettlement';
import storeMapRaw from '@/data/platform_store_map.json';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  /** Omzet versi sistem kita (POS / Pawoon) untuk rentang yang sama. */
  sistemOmzetKotor: number;
  sistemTrxCount: number;
  sistemPromoKasir?: number;
  subsidiPlatform?: number;
}

export interface SettlementUploadStatus {
  latestUploads: Record<
    string,
    {
      platform: string;
      label: string;
      lastSettlementDate: string | null;
      lastImportedAt: string | null;
      rowCount: number;
      sourceFile: string | null;
      daysAgo: number | null;
    }
  >;
  gofoodStatus: {
    isOverdue: boolean;
    lastImportedAt: string | null;
    lastSettlementDate: string | null;
    daysAgo: number | null;
  };
  recentSettlements: {
    id: string;
    platform: string;
    outlet_id: string;
    outlet_name: string;
    tanggal: string;
    omzet_kotor: number;
    promo_merchant: number;
    commission: number;
    trx_count: number;
    source_file: string;
    imported_at: string;
  }[];
}

const PLATFORM_LABELS: Record<string, string> = {
  shopeefood: 'ShopeeFood',
  grabfood: 'GrabFood',
  gofood: 'GoFood',
  tiktokgo: 'TikTok Go',
};

/** Menggabungkan pemetaan statis JSON dengan pemetaan dinamis di DB (`platform_store_mapping`). */
async function getCombinedStoreMap(
  supabase: any,
  platform: string,
  outletNameById: Map<string, string>
): Promise<StoreMapEntry> {
  const base = storeMap[platform] ?? { byStoreId: {}, byName: {}, closed: {} };
  const map: StoreMapEntry = {
    byStoreId: { ...base.byStoreId },
    byName: { ...base.byName },
    closed: { ...base.closed },
  };

  try {
    const { data: dbRows } = await supabase
      .from('platform_store_mapping')
      .select('store_key, outlet_id')
      .eq('platform', platform);

    if (dbRows) {
      for (const r of dbRows) {
        const oName = outletNameById.get(r.outlet_id);
        if (oName) {
          map.byStoreId[r.store_key] = oName;
          map.byName[r.store_key.trim().toLowerCase()] = oName;
        }
      }
    }
  } catch (e) {
    console.warn('Gagal membaca tabel platform_store_mapping:', e);
  }

  return map;
}

/** Mengambil data pembanding dari POS Internal (tabel `orders`) atau fallback ke `sales_daily_spv`. */
async function getPosComparisonByOutlet(
  supabase: any,
  params: {
    outletIds: string[];
    from: string;
    to: string;
    platform?: string;
    platforms?: string[];
  }
) {
  const { outletIds, from, to, platform, platforms } = params;
  const result = new Map<string, { omzet: number; trx: number; promo: number }>();
  if (outletIds.length === 0) return result;

  const fromIso = `${from}T00:00:00+07:00`;
  const toIso = `${to}T23:59:59.999+07:00`;

  // Tentukan target platform yang akan dibandingkan
  const targetPlatforms =
    platforms && platforms.length > 0
      ? platforms.map((p) => p.toLowerCase())
      : platform && platform !== 'all'
      ? [platform.toLowerCase()]
      : ['gofood', 'grabfood', 'shopeefood', 'tiktokgo'];

  // Bangun filter platform di level SQL secara spesifik
  // PENTING: Gunakan 'gofood' (bukan 'go') agar channel 'tiktokgo' tidak sengaja tercampur ke GoFood!
  const filterParts: string[] = [];
  for (const p of targetPlatforms) {
    if (p === 'gofood') {
      filterParts.push('channel.ilike.%gofood%', 'sales_source.ilike.%gofood%');
    } else if (p === 'grabfood') {
      filterParts.push('channel.ilike.%grab%', 'sales_source.ilike.%grab%');
    } else if (p === 'shopeefood') {
      filterParts.push('channel.ilike.%shopee%', 'sales_source.ilike.%shopee%');
    } else if (p === 'tiktokgo' || p === 'tiktok') {
      filterParts.push('channel.ilike.%tiktok%', 'sales_source.ilike.%tiktok%');
    } else {
      filterParts.push(`channel.ilike.%${p}%`, `sales_source.ilike.%${p}%`);
    }
  }
  const orFilter = filterParts.join(',');

  // Tarik data dengan paginasi agar seluruh data dalam rentang (bisa >1000 baris) terambil lengkap
  const step = 1000;
  let offset = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from('orders')
      .select('outlet_id, channel, sales_source, total_amount, promo_subsidy')
      .in('status', ['completed', 'settled'])
      .in('outlet_id', outletIds)
      .or(orFilter)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .range(offset, offset + step - 1);

    if (error || !batch || batch.length === 0) break;

    for (const o of batch) {
      const ch = String(o.channel || '').toLowerCase();
      const ss = String(o.sales_source || '').toLowerCase();

      // Validasi ketat di level objek: pastikan pesanan benar-benar milik platform target
      const matchesTarget = targetPlatforms.some((p) => {
        if (p === 'gofood') {
          return (
            (ch.includes('gofood') || ss.includes('gofood')) &&
            !ch.includes('tiktok') &&
            !ss.includes('tiktok')
          );
        }
        if (p === 'grabfood') {
          return ch.includes('grab') || ss.includes('grab');
        }
        if (p === 'shopeefood') {
          return ch.includes('shopee') || ss.includes('shopee');
        }
        if (p === 'tiktokgo' || p === 'tiktok') {
          return ch.includes('tiktok') || ss.includes('tiktok');
        }
        return ch.includes(p) || ss.includes(p);
      });

      if (!matchesTarget) continue;

      const cur = result.get(o.outlet_id) ?? { omzet: 0, trx: 0, promo: 0 };
      // Di Food Apps, total_amount di DB sudah merupakan nilai omzet kotor (Gross Revenue).
      // Jangan tambahkan promo_subsidy lagi agar tidak terhitung dua kali.
      const gross = Number(o.total_amount) || 0;
      cur.omzet += gross;
      cur.trx += 1;
      cur.promo += Number(o.promo_subsidy) || 0;
      result.set(o.outlet_id, cur);
    }

    if (batch.length < step) break;
    offset += step;
  }

  // Fallback: Jika orders kosong (misal range data historis <= Juli 2026 dari Pawoon)
  if (result.size === 0) {
    const compareChannel = platform ? PLATFORM_COMPARE_CHANNEL[platform as PlatformId] ?? 'food_apps' : 'food_apps';
    const { data: pawoonData } = await supabase
      .from('sales_daily_spv')
      .select('outlet_id, omzet, jumlah_order_completed')
      .gte('sales_date', from)
      .lte('sales_date', to)
      .in('outlet_id', outletIds)
      .eq('sales_source', compareChannel);

    for (const r of (pawoonData ?? []) as any[]) {
      const cur = result.get(r.outlet_id) ?? { omzet: 0, trx: 0, promo: 0 };
      cur.omzet += Number(r.omzet) || 0;
      cur.trx += Number(r.jumlah_order_completed) || 0;
      result.set(r.outlet_id, cur);
    }
  }

  return result;
}

export async function previewSettlementFile(formData: FormData) {
  const supabase = getSupabase();
  try {
    await requireRole(['admin', 'owner']);

    const platform = String(formData.get('platform') ?? '');
    const file = formData.get('file') as File | null;
    if (!file) return { success: false as const, error: 'File belum dipilih.' };

    const parser = getParser(platform);
    const rows: SettlementRow[] = parser.parse(await file.arrayBuffer());

    const { data: outletsData, error: outletsErr } = await supabase.from('outlets').select('id, name');
    if (outletsErr) return { success: false as const, error: `Gagal memuat outlet: ${outletsErr.message}` };

    const outletIdByName = new Map<string, string>(
      (outletsData ?? []).map((o) => [String(o.name).trim().toLowerCase(), o.id as string])
    );
    const outletNameById = new Map<string, string>(
      (outletsData ?? []).map((o) => [o.id as string, String(o.name).trim()])
    );

    // Pemetaan toko platform -> outlet kita (gabungan JSON + DB)
    const map = await getCombinedStoreMap(supabase, platform, outletNameById);

    const unmapped = new Map<string, { storeId: string; storeName: string; omzetKotor: number }>();
    const skippedClosed = new Map<string, { storeId: string; storeName: string; omzetKotor: number }>();

    // Agregasi per (outlet, tanggal) — disimpan ke DB
    const dailyMap = new Map<string, SettlementDaily>();
    const storeNamesByOutlet = new Map<string, Set<string>>();

    for (const r of rows) {
      if (map.closed[r.storeId] || map.closed[r.storeName.trim().toLowerCase()]) {
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

    // Pembanding POS Internal
    const settlementOutletIds = [...new Set(daily.map((d) => d.outletId!))];
    const sistemByOutlet = await getPosComparisonByOutlet(supabase, {
      outletIds: settlementOutletIds,
      from: periodeFrom,
      to: periodeTo,
      platform,
    });

    const perOutletMap = new Map<string, OutletComparison>();
    for (const d of daily) {
      const id = d.outletId!;
      const posData = sistemByOutlet.get(id) ?? { omzet: 0, trx: 0, promo: 0 };
      const cur = perOutletMap.get(id) ?? {
        outletId: id,
        outletName: d.outletName ?? '-',
        storeNames: [...(storeNamesByOutlet.get(id) ?? [])],
        trxCount: 0,
        omzetKotor: 0,
        promoMerchant: 0,
        commission: 0,
        sistemOmzetKotor: posData.omzet,
        sistemTrxCount: posData.trx,
        sistemPromoKasir: posData.promo,
        subsidiPlatform: 0,
      };
      cur.trxCount += d.trxCount;
      cur.omzetKotor += d.omzetKotor;
      cur.promoMerchant += d.promoMerchant;
      cur.commission += d.commission;
      // Untuk GoFood: subsidi = kasir promo - promo merchant
      if (platform === 'gofood') {
        cur.subsidiPlatform = Math.max(0, (cur.sistemPromoKasir ?? 0) - cur.promoMerchant);
      }
      perOutletMap.set(id, cur);
    }
    const perOutlet = [...perOutletMap.values()].sort((a, b) => b.omzetKotor - a.omzetKotor);

    const { count: existingCount } = await supabase
      .from('platform_settlements')
      .select('id', { count: 'exact', head: true })
      .eq('platform', platform)
      .gte('tanggal', periodeFrom)
      .lte('tanggal', periodeTo);

    const totalOmzetKotor = perOutlet.reduce((s, o) => s + o.omzetKotor, 0);
    const totalCommission = perOutlet.reduce((s, o) => s + o.commission, 0);
    const totalPromo = perOutlet.reduce((s, o) => s + o.promoMerchant, 0);
    const totalPosOmzet = perOutlet.reduce((s, o) => s + o.sistemOmzetKotor, 0);
    const totalPosPromo = perOutlet.reduce((s, o) => s + (o.sistemPromoKasir ?? 0), 0);
    const totalSubsidiPlatform = perOutlet.reduce((s, o) => s + (o.subsidiPlatform ?? 0), 0);

    return {
      success: true as const,
      summary: {
        platform,
        platformLabel: parser.label,
        compareChannel: PLATFORM_COMPARE_CHANNEL[platform as PlatformId] ?? 'food_apps',
        fileName: file.name,
        periodeFrom,
        periodeTo,
        totalTrx: rows.length,
        totalOmzetKotor,
        totalPromo,
        totalCommission,
        commissionPct: totalOmzetKotor > 0 ? (totalCommission / totalOmzetKotor) * 100 : 0,
        rowsToWrite: daily.length,
        existingRows: existingCount ?? 0,
        posOmzetKotor: totalPosOmzet,
        posPromoKasir: totalPosPromo,
        totalSubsidiPlatform,
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
  const supabase = getSupabase();
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

export interface OutletPlatformDetail {
  outletId: string;
  outletName: string;
  omzetKotor: number;
  adminFee: number;
  promo: number;
  nettoCair: number;
  posOmzet: number;
  posTrx: number;
  posPromo: number;
  subsidiPlatform: number;
  selisihPromo: number;
}

export interface MultiPlatformSummary {
  periodeFrom: string;
  periodeTo: string;
  isAutoAligned?: boolean;
  primaryPlatform: 'all' | 'shopeefood' | 'grabfood' | 'gofood' | 'tiktokgo';
  totalOmzetKotor: number;
  totalAdminFee: number;
  totalPromo: number;
  totalTrx: number;
  pawoonOmzetKotor: number;
  pawoonTrxCount: number;
  posOmzetKotor: number;
  posTrxCount: number;
  posPromoKasir: number;
  totalSubsidiPlatform: number;
  perPlatform: {
    platform: string;
    label: string;
    fileName: string;
    omzetKotor: number;
    adminFee: number;
    promo: number;
    trx: number;
    rowsToWrite: number;
    posOmzetKotor?: number;
    posTrxCount?: number;
    posPromoKasir?: number;
    subsidiPlatform?: number;
    perOutlet?: OutletPlatformDetail[];
  }[];
  perOutlet: {
    outletId: string;
    outletName: string;
    omzetKotor: number;
    adminFee: number;
    promo: number;
    nettoCair: number;
    pawoonOmzet: number;
    posOmzet: number;
    posTrx: number;
    posPromo: number;
    subsidiPlatform: number;
    selisihPromo: number;
  }[];
  unmappedStores: { platform: string; storeId: string; storeName: string; omzetKotor: number }[];
  allDaily: { platform: string; sourceFile: string; daily: SettlementDaily[] }[];
}

export async function previewAllSettlementFiles(formData: FormData): Promise<
  { success: true; summary: MultiPlatformSummary } | { success: false; error: string }
> {
  const supabase = getSupabase();
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
    const outletNameById = new Map<string, string>(
      (outletsData ?? []).map((o) => [o.id as string, String(o.name).trim()])
    );

    const outletOmzet = new Map<string, number>();
    const outletAdminFee = new Map<string, number>();
    const outletPromo = new Map<string, number>();
    const outletNames = new Map<string, string>();
    const platformOutletData = new Map<string, Map<string, { omzet: number; promo: number; fee: number }>>();

    const perPlatform: MultiPlatformSummary['perPlatform'] = [];
    const unmappedMap = new Map<string, { platform: string; storeId: string; storeName: string; omzetKotor: number }>();
    const allDaily: MultiPlatformSummary['allDaily'] = [];

    for (const platform of platformIds) {
      const file = formData.get(`file_${platform}`) as File | null;
      if (!file) continue;

      const map = await getCombinedStoreMap(supabase, platform, outletNameById);
      const parser = getParser(platform);
      const rows: SettlementRow[] = parser.parse(await file.arrayBuffer());

      const dailyMap = new Map<string, SettlementDaily>();
      const pOutletMap = new Map<string, { omzet: number; promo: number; fee: number }>();

      for (const r of rows) {
        if (map.closed[r.storeId] || map.closed[r.storeName.trim().toLowerCase()]) continue;
        const oName = map.byStoreId[r.storeId] ?? map.byName[r.storeName.trim().toLowerCase()] ?? null;
        const oId = oName ? outletIdByName.get(oName.trim().toLowerCase()) ?? null : null;
        if (!oId) {
          const key = `${platform}|${r.storeId || r.storeName}`;
          const ex = unmappedMap.get(key);
          if (ex) {
            ex.omzetKotor += r.omzetKotor;
          } else {
            unmappedMap.set(key, { platform, storeId: r.storeId, storeName: r.storeName, omzetKotor: r.omzetKotor });
          }
          continue;
        }
        if (!allowedOutletIds.includes(oId)) continue;
        if (oName) outletNames.set(oId, oName);
        const key = `${oId}|${r.date}`;
        const ex = dailyMap.get(key);
        if (ex) {
          ex.omzetKotor += r.omzetKotor;
          ex.promoMerchant += r.promoMerchant;
          ex.commission += r.commission;
          ex.trxCount += 1;
        } else {
          dailyMap.set(key, {
            storeId: r.storeId,
            storeName: r.storeName,
            outletName: oName,
            outletId: oId,
            date: r.date,
            omzetKotor: r.omzetKotor,
            promoMerchant: r.promoMerchant,
            commission: r.commission,
            trxCount: 1,
          });
        }

        const curPOut = pOutletMap.get(oId) ?? { omzet: 0, promo: 0, fee: 0 };
        curPOut.omzet += r.omzetKotor;
        curPOut.promo += r.promoMerchant;
        curPOut.fee += r.commission;
        pOutletMap.set(oId, curPOut);
      }

      platformOutletData.set(platform, pOutletMap);

      const daily = [...dailyMap.values()];
      const pOmzet = daily.reduce((s, d) => s + d.omzetKotor, 0);
      const pFee = daily.reduce((s, d) => s + d.commission, 0);
      const pPromo = daily.reduce((s, d) => s + d.promoMerchant, 0);
      const pTrx = daily.reduce((s, d) => s + d.trxCount, 0);

      perPlatform.push({
        platform,
        label: PLATFORM_LABELS[platform] ?? platform,
        fileName: file.name,
        omzetKotor: pOmzet,
        adminFee: pFee,
        promo: pPromo,
        trx: pTrx,
        rowsToWrite: daily.length,
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

    // Otomatis deteksi rentang tanggal dari file settlement yang diunggah
    const allFileDates = allDaily
      .flatMap((p) => p.daily.map((d) => d.date))
      .filter(Boolean)
      .sort();

    const fileMinDate = allFileDates.length > 0 ? allFileDates[0] : null;
    const fileMaxDate = allFileDates.length > 0 ? allFileDates[allFileDates.length - 1] : null;

    // Selaraskan periode dengan isi file aktual (Single Source of Truth)
    // agar pembanding POS membandingkan rentang tanggal yang persis sama dengan file yang diunggah
    const effectiveFrom = fileMinDate || periodeFrom;
    const effectiveTo = fileMaxDate || periodeTo;
    const isAutoAligned = Boolean(
      fileMinDate && fileMaxDate && (fileMinDate !== periodeFrom || fileMaxDate !== periodeTo)
    );

    const settlementOutletIds = [...outletOmzet.keys()];

    // Tarik pembanding POS gabungan untuk semua platform
    const posByOutletOverall = await getPosComparisonByOutlet(supabase, {
      outletIds: settlementOutletIds,
      from: effectiveFrom,
      to: effectiveTo,
      platforms: perPlatform.map((p) => p.platform),
    });

    // Tarik pembanding POS per platform secara terpisah untuk presisi perbandingan
    const posByPlatform = new Map<string, Map<string, { omzet: number; trx: number; promo: number }>>();
    for (const p of perPlatform) {
      const pPosMap = await getPosComparisonByOutlet(supabase, {
        outletIds: settlementOutletIds,
        from: effectiveFrom,
        to: effectiveTo,
        platforms: [p.platform],
      });
      posByPlatform.set(p.platform, pPosMap);
    }

    let totalSubsidiPlatform = 0;

    // Lengkapi rincian per-platform dan per-outlet di tiap platform
    for (const p of perPlatform) {
      const pPosMap = posByPlatform.get(p.platform) ?? new Map();
      const pPosOmzet = [...pPosMap.values()].reduce((s, v) => s + v.omzet, 0);
      const pPosTrx = [...pPosMap.values()].reduce((s, v) => s + v.trx, 0);
      const pPosPromo = [...pPosMap.values()].reduce((s, v) => s + v.promo, 0);

      p.posOmzetKotor = pPosOmzet;
      p.posTrxCount = pPosTrx;
      p.posPromoKasir = pPosPromo;

      const pOutletsMap = platformOutletData.get(p.platform) ?? new Map();
      let pSubsidi = 0;

      const pOutletList: OutletPlatformDetail[] = [...pOutletsMap.entries()]
        .map(([oId, data]) => {
          const pos = pPosMap.get(oId) ?? { omzet: 0, trx: 0, promo: 0 };
          // Subsidi platform HANYA dihitung untuk GoFood dan TikTok Go.
          // Untuk ShopeeFood dan GrabFood, diskon kasir adalah diskon toko murni (bukan subsidi platform).
          const subsidi =
            p.platform === 'gofood' || p.platform === 'tiktokgo'
              ? Math.max(0, pos.promo - data.promo)
              : 0;
          pSubsidi += subsidi;

          return {
            outletId: oId,
            outletName: outletNames.get(oId) ?? oId,
            omzetKotor: data.omzet,
            adminFee: data.fee,
            promo: data.promo,
            nettoCair: data.omzet - data.fee - data.promo,
            posOmzet: pos.omzet,
            posTrx: pos.trx,
            posPromo: pos.promo,
            subsidiPlatform: subsidi,
            selisihPromo: pos.promo - data.promo,
          };
        })
        .sort((a, b) => b.omzetKotor - a.omzetKotor);

      p.subsidiPlatform = pSubsidi;
      p.perOutlet = pOutletList;

      if (p.platform === 'gofood' || p.platform === 'tiktokgo') {
        totalSubsidiPlatform += pSubsidi;
      }
    }

    const allOutletIds = new Set([...outletOmzet.keys()]);
    const perOutlet: MultiPlatformSummary['perOutlet'] = [...allOutletIds]
      .map((id) => {
        const omzet = outletOmzet.get(id) ?? 0;
        const adminFee = outletAdminFee.get(id) ?? 0;
        const promo = outletPromo.get(id) ?? 0;
        const nettoCair = omzet - adminFee - promo;
        const pos = posByOutletOverall.get(id) ?? { omzet: 0, trx: 0, promo: 0 };

        let outletSubsidi = 0;
        for (const p of perPlatform) {
          const pOutlet = p.perOutlet?.find((o) => o.outletId === id);
          if (pOutlet) outletSubsidi += pOutlet.subsidiPlatform;
        }

        return {
          outletId: id,
          outletName: outletNames.get(id) ?? id,
          omzetKotor: omzet,
          adminFee,
          promo,
          nettoCair,
          pawoonOmzet: pos.omzet,
          posOmzet: pos.omzet,
          posTrx: pos.trx,
          posPromo: pos.promo,
          subsidiPlatform: outletSubsidi,
          selisihPromo: pos.promo - promo,
        };
      })
      .sort((a, b) => b.omzetKotor - a.omzetKotor);

    const totalPosOmzet = [...posByOutletOverall.values()].reduce((s, v) => s + v.omzet, 0);
    const totalPosTrx = [...posByOutletOverall.values()].reduce((s, v) => s + v.trx, 0);
    const totalPosPromo = [...posByOutletOverall.values()].reduce((s, v) => s + v.promo, 0);

    const primaryPlatform: MultiPlatformSummary['primaryPlatform'] =
      perPlatform.length === 1
        ? (perPlatform[0].platform as any)
        : 'all';

    return {
      success: true,
      summary: {
        periodeFrom: effectiveFrom,
        periodeTo: effectiveTo,
        isAutoAligned,
        primaryPlatform,
        totalOmzetKotor: perPlatform.reduce((s, p) => s + p.omzetKotor, 0),
        totalAdminFee: perPlatform.reduce((s, p) => s + p.adminFee, 0),
        totalPromo: perPlatform.reduce((s, p) => s + p.promo, 0),
        totalTrx: perPlatform.reduce((s, p) => s + p.trx, 0),
        pawoonOmzetKotor: totalPosOmzet,
        pawoonTrxCount: totalPosTrx,
        posOmzetKotor: totalPosOmzet,
        posTrxCount: totalPosTrx,
        posPromoKasir: totalPosPromo,
        totalSubsidiPlatform,
        perPlatform,
        perOutlet,
        unmappedStores: [...unmappedMap.values()],
        allDaily,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Terjadi kesalahan tak terduga.' };
  }
}

export async function syncAllSettlementData(allDaily: MultiPlatformSummary['allDaily']) {
  const supabase = getSupabase();
  try {
    const { userId } = await requireRole(['admin', 'owner']);
    let totalSaved = 0;
    for (const { platform, sourceFile, daily } of allDaily) {
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
      totalSaved += records.length;
    }
    return { success: true as const, savedRows: totalSaved };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Gagal menyimpan data.' };
  }
}

/** Menyimpan pemetaan toko baru ke database (`platform_store_mapping`). */
export async function saveStoreMapping(payload: {
  platform: string;
  storeKey: string;
  outletId: string;
}) {
  const supabase = getSupabase();
  try {
    const { userId } = await requireRole(['admin', 'owner']);
    const { platform, storeKey, outletId } = payload;
    if (!platform || !storeKey || !outletId) {
      return { success: false as const, error: 'Data pemetaan tidak lengkap.' };
    }

    const { data: existing } = await supabase
      .from('platform_store_mapping')
      .select('id')
      .eq('platform', platform)
      .eq('store_key', storeKey.trim())
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase
        .from('platform_store_mapping')
        .update({ outlet_id: outletId, created_by: userId })
        .eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from('platform_store_mapping').insert({
        platform,
        store_key: storeKey.trim(),
        outlet_id: outletId,
        created_at: new Date().toISOString(),
        created_by: userId,
      });
      if (insErr) throw insErr;
    }

    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Gagal menyimpan pemetaan toko.' };
  }
}

/** Mengambil status upload settlement (kapan terakhir upload, overdue alert, history). */
export async function getSettlementDashboardStatus(): Promise<
  { success: true; data: SettlementUploadStatus } | { success: false; error: string }
> {
  const supabase = getSupabase();
  try {
    await requireRole(['admin', 'owner']);

    const platforms = ['gofood', 'grabfood', 'shopeefood', 'tiktokgo'];
    const latestUploads: SettlementUploadStatus['latestUploads'] = {};

    const { data: outlets } = await supabase.from('outlets').select('id, name');
    const outletNameMap = new Map((outlets ?? []).map((o) => [o.id, o.name]));

    const now = new Date();

    for (const p of platforms) {
      const { data: rows } = await supabase
        .from('platform_settlements')
        .select('tanggal, imported_at, source_file')
        .eq('platform', p)
        .order('tanggal', { ascending: false })
        .limit(1);

      if (rows && rows.length > 0) {
        const lastRow = rows[0];
        const lastImportDate = lastRow.imported_at ? new Date(lastRow.imported_at) : null;
        const diffDays = lastImportDate
          ? Math.floor((now.getTime() - lastImportDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const { count } = await supabase
          .from('platform_settlements')
          .select('id', { count: 'exact', head: true })
          .eq('platform', p);

        latestUploads[p] = {
          platform: p,
          label: PLATFORM_LABELS[p] ?? p,
          lastSettlementDate: lastRow.tanggal,
          lastImportedAt: lastRow.imported_at,
          rowCount: count ?? 0,
          sourceFile: lastRow.source_file,
          daysAgo: diffDays,
        };
      } else {
        latestUploads[p] = {
          platform: p,
          label: PLATFORM_LABELS[p] ?? p,
          lastSettlementDate: null,
          lastImportedAt: null,
          rowCount: 0,
          sourceFile: null,
          daysAgo: null,
        };
      }
    }

    const gofoodStat = latestUploads.gofood;
    const isOverdue = !gofoodStat.lastImportedAt || (gofoodStat.daysAgo !== null && gofoodStat.daysAgo > 7);

    // Ambil 15 riwayat upload settlement terakhir
    const { data: recentData } = await supabase
      .from('platform_settlements')
      .select('id, platform, outlet_id, tanggal, omzet_kotor, promo_merchant, commission, trx_count, source_file, imported_at')
      .order('imported_at', { ascending: false })
      .limit(15);

    const recentSettlements = (recentData ?? []).map((r: any) => ({
      id: r.id,
      platform: r.platform,
      outlet_id: r.outlet_id,
      outlet_name: outletNameMap.get(r.outlet_id) || r.outlet_id,
      tanggal: r.tanggal,
      omzet_kotor: Number(r.omzet_kotor) || 0,
      promo_merchant: Number(r.promo_merchant) || 0,
      commission: Number(r.commission) || 0,
      trx_count: Number(r.trx_count) || 0,
      source_file: r.source_file || 'manual',
      imported_at: r.imported_at,
    }));

    return {
      success: true,
      data: {
        latestUploads,
        gofoodStatus: {
          isOverdue,
          lastImportedAt: gofoodStat.lastImportedAt,
          lastSettlementDate: gofoodStat.lastSettlementDate,
          daysAgo: gofoodStat.daysAgo,
        },
        recentSettlements,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memuat status upload.' };
  }
}

/** Menghapus data settlement untuk platform dan rentang tanggal tertentu (rollback). */
export async function deleteSettlementBatch(payload: {
  platform: string;
  from: string;
  to: string;
  outletId?: string;
}) {
  const supabase = getSupabase();
  try {
    await requireRole(['admin', 'owner']);
    const { platform, from, to, outletId } = payload;
    if (!platform || !from || !to) {
      return { success: false as const, error: 'Parameter tidak lengkap.' };
    }

    let q = supabase
      .from('platform_settlements')
      .delete()
      .eq('platform', platform)
      .gte('tanggal', from)
      .lte('tanggal', to);

    if (outletId) {
      q = q.eq('outlet_id', outletId);
    }

    const { error, count } = await q;
    if (error) throw error;

    return { success: true as const, deletedCount: count ?? 0 };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Gagal menghapus data settlement.' };
  }
}
