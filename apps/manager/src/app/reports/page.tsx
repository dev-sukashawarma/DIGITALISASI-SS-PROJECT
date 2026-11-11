import React from 'react';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import ReportsClient from './ReportsClient';
import { TEST_OUTLET_ID } from '@/lib/outletFilters';
import { cleanItemName } from '@/lib/order-item-name';
import { getMenuItemsData, getRiwayatHppData } from '@/lib/menuCache';
import {
  buildFoodAppsSettlementPromoMap,
  computeOrderDeduction,
  computeOrderGross,
  computeOrderPlatformSubsidy,
  filterOrdersByChannel,
  mapEcommerceSaleToOrder,
} from '@/lib/posReportKpi';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

const FULL_ACCESS_ROLES = ['regional_manager', 'admin', 'owner', 'developer'];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));
  
  const resolvedSearchParams = await searchParams;
  
  const range = (resolvedSearchParams.range as DateRange) || 'today';
  const customStart = (resolvedSearchParams.customStart as string) || '';
  const customEnd = (resolvedSearchParams.customEnd as string) || '';
  const channelFilter = (resolvedSearchParams.channel as string) || 'all';
  const paymentFilter = (resolvedSearchParams.payment as string) || 'all';
  const statusFilter = (resolvedSearchParams.status as string) || 'all';
  const outletFilter = (resolvedSearchParams.outlet_id as string) || 'all';

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Helper tanggal YYYY-MM-DD dalam zona waktu Asia/Jakarta (WIB)
  const getJakartaDateStr = (offsetDays: number = 0): string => {
    const jakartaStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const d = new Date(jakartaStr);
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  let fromDateStr = getJakartaDateStr(0);
  let toDateStr = getJakartaDateStr(0);

  if (range === 'today') {
    fromDateStr = getJakartaDateStr(0);
    toDateStr = getJakartaDateStr(0);
  } else if (range === 'yesterday') {
    fromDateStr = getJakartaDateStr(-1);
    toDateStr = getJakartaDateStr(-1);
  } else if (range === '7days') {
    fromDateStr = getJakartaDateStr(-6);
    toDateStr = getJakartaDateStr(0);
  } else if (range === '30days') {
    fromDateStr = getJakartaDateStr(-29);
    toDateStr = getJakartaDateStr(0);
  } else if (range === 'all') {
    fromDateStr = '2020-01-01';
    toDateStr = getJakartaDateStr(0);
  } else if (range === 'custom' && customStart && customEnd) {
    fromDateStr = customStart;
    toDateStr = customEnd;
  }

  const p_start = new Date(`${fromDateStr}T00:00:00.000+07:00`);
  const p_end = new Date(`${toDateStr}T23:59:59.999+07:00`);

  // Supabase PostgREST max-rows default = 1000, cannot be overridden by .limit().
  // Use manual pagination with .range() and fresh query builder to fetch all rows deterministically.
  const fetchAllPages = async (buildQuery: () => any): Promise<any[]> => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  let accessibleOutlets: string[] = [];
  if (staff?.role === 'area_manager') {
    const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
    const assignedIds = [
      ...((so || []).map((s: any) => s.outlet_id)),
      ...(staff.outlet_id ? [staff.outlet_id] : [])
    ];
    const uniqueIds = Array.from(new Set(assignedIds));
    if (uniqueIds.length > 0) {
      accessibleOutlets = uniqueIds;
    } else {
      accessibleOutlets = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  // Handle Outlet Filter
  const permittedOutletId = outletFilter;
  const isFullAccess = !staff || FULL_ACCESS_ROLES.includes(staff.role);

  const buildOrdersQuery = () => {
    let q = supabaseAdmin
      .from('orders')
      .select('id, order_number, status, payment_method, channel, sales_source, customer_name, is_endorse, total_amount, discount_amount, promo_subsidy, created_at, voided_by, void_reason, cancellation_reason, outlet_id, order_items(id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, is_promo_reward)')
      .gte('created_at', p_start.toISOString())
      .lte('created_at', p_end.toISOString())
      .neq('outlet_id', TEST_OUTLET_ID);

    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    if (paymentFilter !== 'all') {
      q = q.eq('payment_method', paymentFilter);
    }

    if (staff?.role === 'area_manager') {
      if (permittedOutletId !== 'all' && accessibleOutlets.includes(permittedOutletId)) {
        q = q.eq('outlet_id', permittedOutletId);
      } else {
        q = q.in('outlet_id', accessibleOutlets);
      }
    } else if (isFullAccess) {
      if (permittedOutletId !== 'all' && permittedOutletId !== 'ss-online') {
        q = q.eq('outlet_id', permittedOutletId);
      }
    } else if (staff?.outlet_id) {
      q = q.eq('outlet_id', staff.outlet_id);
    }

    return q
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
  };

  // Sertakan penjualan SS Online (ecommerce_sales) untuk RM/Admin/Developer saat memilih Semua Outlet atau SS Online
  const shouldIncludeEcommerce =
    isFullAccess &&
    (permittedOutletId === 'all' || permittedOutletId === 'ss-online') &&
    paymentFilter === 'all' &&
    (statusFilter === 'all' || statusFilter === 'completed');

  const buildEcommerceQuery = () =>
    supabaseAdmin
      .from('ecommerce_sales')
      .select('id, order_id, channel_id, total_amount, order_date, raw_data, ecommerce_sale_items(id, menu_id, quantity, price, subtotal, menu_items:menu_id(id, name))')
      .gte('order_date', p_start.toISOString())
      .lte('order_date', p_end.toISOString())
      .order('order_date', { ascending: true })
      .order('id', { ascending: true });

  // Ambil data rekonsiliasi platform_settlements (Single Source of Truth untuk Potongan Merchant & Subsidi Platform Food Apps)
  const buildSettlementsQuery = () => {
    let q = supabaseAdmin
      .from('platform_settlements')
      .select('id, outlet_id, platform, tanggal, omzet_kotor, promo_merchant, commission')
      .gte('tanggal', fromDateStr)
      .lte('tanggal', toDateStr);

    if (staff?.role === 'area_manager') {
      if (permittedOutletId !== 'all' && accessibleOutlets.includes(permittedOutletId)) {
        q = q.eq('outlet_id', permittedOutletId);
      } else {
        q = q.in('outlet_id', accessibleOutlets);
      }
    } else if (isFullAccess) {
      if (permittedOutletId !== 'all' && permittedOutletId !== 'ss-online') {
        q = q.eq('outlet_id', permittedOutletId);
      }
    } else if (staff?.outlet_id) {
      q = q.eq('outlet_id', staff.outlet_id);
    }

    return q.order('id', { ascending: true });
  };

  // Fetch Outlets for the filter dropdown & mitra HPP markup
  let qOutlets = supabaseAdmin.from('outlets').select('id, name, type').eq('is_active', true).neq('id', TEST_OUTLET_ID);
  if (staff?.role === 'area_manager') {
    qOutlets = qOutlets.in('id', accessibleOutlets);
  } else if (staff?.outlet_id && !isFullAccess) {
    qOutlets = qOutlets.eq('id', staff.outlet_id);
  }

  const [posOrdersData, ecommerceSalesData, settlementsData, { data: outletsData }, menuItemsData, riwayatHppData] = await Promise.all([
    permittedOutletId === 'ss-online' ? Promise.resolve([]) : fetchAllPages(buildOrdersQuery),
    shouldIncludeEcommerce ? fetchAllPages(buildEcommerceQuery) : Promise.resolve([]),
    fetchAllPages(buildSettlementsQuery),
    qOutlets,
    getMenuItemsData(supabaseAdmin),
    getRiwayatHppData(supabaseAdmin),
  ]);

  const outletTypeMap = new Map<string, string>();
  for (const o of outletsData || []) {
    if (o.id) outletTypeMap.set(o.id, String(o.type || 'internal').toLowerCase());
  }

  type TitikRiwayat = { tgl: string; nilai: number | null };
  const indeksRiwayat = new Map<string, Map<string, TitikRiwayat[]>>();
  for (const r of riwayatHppData || []) {
    if (!r?.menu_item_id || !r?.kunci || !r?.berlaku_mulai) continue;
    let perKunci = indeksRiwayat.get(r.menu_item_id);
    if (!perKunci) {
      perKunci = new Map();
      indeksRiwayat.set(r.menu_item_id, perKunci);
    }
    let titik = perKunci.get(r.kunci);
    if (!titik) {
      titik = [];
      perKunci.set(r.kunci, titik);
    }
    titik.push({
      tgl: String(r.berlaku_mulai).slice(0, 10),
      nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    });
  }
  for (const perKunci of indeksRiwayat.values()) {
    for (const titik of perKunci.values()) {
      titik.sort((a, b) => a.tgl.localeCompare(b.tgl));
    }
  }

  const menuPrioritas = (m: any): number => {
    const cat = (
      (Array.isArray(m?.categories) ? m.categories[0]?.name : m?.categories?.name) ||
      m?.category_name ||
      ''
    ).toLowerCase();
    const isVoucher = cat.includes('voucher pamulang') ? 0 : 1;
    const isGlobal = !m?.outlet_id ? 1 : 0;
    const isActive = m?.is_available !== false ? 1 : 0;
    const hasCategory = cat.length > 0 ? 1 : 0;
    return isVoucher * 1000 + isGlobal * 100 + isActive * 10 + hasCategory;
  };
  const sortedMenuItems = [...(menuItemsData || [])].sort((a, b) => menuPrioritas(b) - menuPrioritas(a));

  const cachePenerapTanggal = new Map<string, { byId: Map<string, any>; byName: Map<string, any> }>();
  const getPenerapUntukTanggal = (tgl: string) => {
    const cached = cachePenerapTanggal.get(tgl);
    if (cached) return cached;
    const nilaiPada = (menuId?: string) => {
      if (!menuId) return null;
      const perKunci = indeksRiwayat.get(menuId);
      if (!perKunci) return null;
      let hpp_override: number | null = null;
      const channel_hpp: Record<string, number> = {};
      for (const [kunci, titik] of perKunci) {
        let nilai: number | null | undefined;
        for (const t of titik) {
          if (t.tgl <= tgl) nilai = t.nilai;
          else break;
        }
        if (nilai === undefined) continue;
        if (kunci === 'hpp_override') hpp_override = nilai;
        else if (nilai !== null) channel_hpp[kunci] = nilai;
      }
      return { hpp_override, channel_hpp };
    };
    const timpa = (m: any): any => {
      if (!m || typeof m !== 'object') return m;
      const v = typeof m.id === 'string' ? nilaiPada(m.id) : null;
      const next: any = v ? { ...m, hpp_override: v.hpp_override, channel_hpp: v.channel_hpp } : { ...m };
      if (Array.isArray(m.package_items)) {
        next.package_items = m.package_items.map((pi: any) =>
          pi?.component ? { ...pi, component: timpa(pi.component) } : pi
        );
      }
      return next;
    };
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const m of sortedMenuItems) {
      const t = timpa(m);
      if (m?.id) byId.set(m.id, t);
      if (m?.name) {
        const kAsli = cleanItemName(m.name);
        const kLower = kAsli.trim().toLowerCase();
        if (!byName.has(kAsli)) byName.set(kAsli, t);
        if (!byName.has(kLower)) byName.set(kLower, t);
      }
    }
    const res = { byId, byName };
    cachePenerapTanggal.set(tgl, res);
    return res;
  };

  const KANAL_SS_ONLINE = new Set<string>([
    'ss_online',
    'ss-online',
    'shopee_shop',
    'tiktok_shop',
    'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
    'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
  ]);
  const adalahKanalSsOnline = (ch: string | null | undefined) =>
    Boolean(ch && KANAL_SS_ONLINE.has(ch.trim().toLowerCase()));

  const MITRA_OPEX_TAKEOUT_START = '2026-10-01';
  const MITRA_DRINK_OPEX_DB_START = '2026-11-02';
  const MITRA_CILEUNGSI_OUTLET_ID = '62a56103-2085-4dd5-9d25-a3c0cffc88ff';
  // Sejak 1 Nov 2026: (HPP + OPEX) x 1,15 untuk SEMUA mitra, Cileungsi ikut.
  // Sumber: "HPP NOVEMBER.xlsx" tab OFFLINE sel P3, keputusan owner 11 Nov 2026.
  // Sama dengan DB get_mitra_item_hpp (migration 20261111101413).
  const MITRA_MARKUP_15_START = '2026-11-01';
  const MITRA_MARKUP_15 = 1.15;
  const PURE_DRINK_IDS_BEFORE_NOV2 = new Set<string>([
    '08a57f8f-f212-4205-a3eb-fb88066ae1b8',
    'c543b78e-3341-44e0-b3ef-53349e71e3d3',
    'c8427af3-0a41-48dd-9a08-6b93cd913ec6',
  ]);

  const hitungHppItem = (
    menuItem: any,
    outletType?: string,
    fallbackName?: string,
    byName?: Map<string, any>,
    channel?: string | null,
    menuItemId?: string | null,
    byId?: Map<string, any>,
    outletId?: string | null,
    orderDate?: string | null
  ): number => {
    let itemObj = menuItem;
    if (!itemObj && menuItemId && byId?.has(menuItemId)) itemObj = byId.get(menuItemId);
    if (!itemObj && fallbackName && byName) {
      const rawClean = cleanItemName(fallbackName);
      const rawLower = rawClean.trim().toLowerCase();
      const candidates = [
        rawClean,
        rawLower,
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').trim(),
        rawLower.replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
        rawLower.replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
        rawLower.replace(/\s+shawarma\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s+shawarma\s*$/i, '').trim(),
      ];
      for (const key of candidates) {
        if (byName.has(key)) {
          itemObj = byName.get(key);
          break;
        }
      }
    }
    if (!itemObj) return 0;
    const normCh = channel ? channel.trim().toLowerCase() : null;
    const isMitra = outletType === 'mitra';

    const extractLeafBase = (obj: any): number => {
      if (!obj) return 0;
      let channelHppVal: number | null = null;
      if (obj.channel_hpp && typeof obj.channel_hpp === 'object' && normCh) {
        if (adalahKanalSsOnline(normCh)) {
          channelHppVal =
            obj.channel_hpp.ss_online ??
            obj.channel_hpp.tiktok_shop ??
            obj.channel_hpp.shopee_shop ??
            obj.channel_hpp[normCh] ??
            null;
        } else {
          channelHppVal = obj.channel_hpp[normCh] ?? null;
        }
      }
      if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
        return Number(channelHppVal);
      }
      if (obj.hpp_override !== null && obj.hpp_override !== undefined && Number(obj.hpp_override) > 0) {
        return Number(obj.hpp_override);
      }
      return 0;
    };

    const extractBase = (obj: any): number => {
      if (!obj) return 0;
      const leaf = extractLeafBase(obj);
      if (leaf > 0) return leaf;
      if (obj.is_package && Array.isArray(obj.package_items)) {
        return obj.package_items.reduce((sum: number, pkg: any) => {
          const compHpp = pkg.component ? extractBase(pkg.component) : 0;
          const qty = pkg.quantity || 1;
          return sum + compHpp * qty;
        }, 0);
      }
      return 0;
    };

    let resolvedObj = itemObj;
    let baseHpp = extractBase(resolvedObj);
    if (baseHpp === 0 && fallbackName && byName) {
      const rawClean = cleanItemName(fallbackName);
      const rawLower = rawClean.trim().toLowerCase();
      const candidates = [
        rawClean,
        rawLower,
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').trim(),
        rawLower.replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
        rawLower.replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
        rawLower.replace(/\s+shawarma\s*$/i, '').trim(),
        rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s+shawarma\s*$/i, '').trim(),
      ];
      for (const key of candidates) {
        if (byName.has(key)) {
          const candObj = byName.get(key);
          const candHpp = extractBase(candObj);
          if (candHpp > 0) {
            resolvedObj = candObj;
            baseHpp = candHpp;
            break;
          }
        }
      }
    }

    if (!isMitra || baseHpp <= 0) return baseHpp;

    const effDate = orderDate ? orderDate.slice(0, 10) : toDateStr;
    // Dicek PALING AWAL supaya Cileungsi ikut markup 15%.
    if (effDate >= MITRA_MARKUP_15_START) {
      return Math.round(baseHpp * MITRA_MARKUP_15);
    }
    if (effDate < MITRA_OPEX_TAKEOUT_START || outletId === MITRA_CILEUNGSI_OUTLET_ID) {
      return Math.round(baseHpp * 1.1);
    }

    const extractMitraRaw = (obj: any): number => {
      if (!obj) return 0;
      const leaf = extractLeafBase(obj);
      if (leaf > 0) {
        const isPureDrink =
          effDate < MITRA_DRINK_OPEX_DB_START &&
          Boolean(obj.id && PURE_DRINK_IDS_BEFORE_NOV2.has(obj.id));
        return isPureDrink ? leaf * 1.1 : leaf;
      }
      if (obj.is_package && Array.isArray(obj.package_items)) {
        return obj.package_items.reduce((sum: number, pkg: any) => {
          const compRaw = pkg.component ? extractMitraRaw(pkg.component) : 0;
          const qty = pkg.quantity || 1;
          return sum + compRaw * qty;
        }, 0);
      }
      return 0;
    };

    return Math.round(extractMitraRaw(resolvedObj));
  };

  const ecommerceOrders = (ecommerceSalesData || []).map(mapEcommerceSaleToOrder);
  const combinedOrders = [...(posOrdersData || []), ...ecommerceOrders];

  // Filter channel menggunakan resolveOrderSource (konsisten dengan Dashboard Admin)
  const filteredOrders = filterOrdersByChannel(combinedOrders, channelFilter);

  // Aggregate the data (sama dengan Admin: completed atau settled)
  const completedOrders = filteredOrders.filter(
    (o: any) => o.status === 'completed' || o.status === 'settled'
  );

  // Rekonsiliasi Platform Settlement sebagai Single Source of Truth untuk Potongan Merchant Food Apps
  const foodAppsSettlementPromoMap = buildFoodAppsSettlementPromoMap(completedOrders, settlementsData || []);
  const kpiOpts = {
    ssOnlineMode: permittedOutletId === 'ss-online',
    getSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    getGofoodSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    gofoodSettlementMap: foodAppsSettlementPromoMap,
  };

  let grossRevenue = 0;
  let totalDeductions = 0;
  let totalPlatformSubsidy = 0;
  let totalHPP = 0;

  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {};
  const hourly = Array(24).fill(0);
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  const outletSalesMap: Record<string, { itemsSold: number; items: Record<string, { name: string; qty: number; revenue: number }> }> = {};

  completedOrders.forEach((o: any) => {
    const outletId = o.outlet_id;
    const outType = outletId ? outletTypeMap.get(outletId) : 'internal';
    const ordChannel = o.channel || o.sales_source || null;
    const tglWib = o.created_at
      ? new Date(new Date(o.created_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10)
      : toDateStr;
    const penerap = getPenerapUntukTanggal(tglWib);

    if (outletId) {
      if (!outletSalesMap[outletId]) outletSalesMap[outletId] = { itemsSold: 0, items: {} };
    }

    // 1. Omzet Kotor, Potongan Merchant, & Subsidi Platform (sama persis dengan Admin computeAnalytics)
    const orderDeduction = computeOrderDeduction(o, kpiOpts);
    const orderGross = computeOrderGross(o, kpiOpts);
    totalDeductions += orderDeduction;
    grossRevenue += orderGross;
    if (o.outlet_id !== 'ss-online') {
      totalPlatformSubsidy += computeOrderPlatformSubsidy(o, kpiOpts);
    }

    // 2. Payment Breakdown
    const pm = o.payment_method || 'unknown';
    if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, revenue: 0 };
    paymentBreakdown[pm].count++;
    paymentBreakdown[pm].revenue += Number(o.total_amount) || 0;

    // 3. Hourly (Asia/Jakarta +7)
    const d = new Date(o.created_at);
    const h = (d.getUTCHours() + 7) % 24;
    hourly[h]++;

    // 4. Best Sellers & HPP (menggunakan cleanItemName & riwayatHpp seperti Admin)
    if (Array.isArray(o.order_items)) {
      o.order_items.forEach((oi: any) => {
        const name = cleanItemName(oi.menu_item_name) || 'Item';
        const qty = Number(oi.quantity) || 0;
        const sub = Number(oi.subtotal) || 0;

        const menuItem = (oi.menu_item_id ? penerap.byId.get(oi.menu_item_id) : null) || penerap.byName.get(name);
        const unitHpp = hitungHppItem(menuItem, outType, name, penerap.byName, ordChannel, oi.menu_item_id, penerap.byId, outletId, tglWib);
        totalHPP += unitHpp * qty;

        if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
        itemMap[name].qty += qty;
        itemMap[name].revenue += sub;

        if (outletId) {
          outletSalesMap[outletId].itemsSold += qty;
          if (!outletSalesMap[outletId].items[name]) {
            outletSalesMap[outletId].items[name] = { name, qty: 0, revenue: 0 };
          }
          outletSalesMap[outletId].items[name].qty += qty;
          outletSalesMap[outletId].items[name].revenue += sub;
        }
      });
    }
  });

  const totalRevenue = grossRevenue;
  const netRevenue = grossRevenue - totalDeductions;
  totalHPP = Math.round(totalHPP);
  const grossProfit = Math.max(0, Math.round(netRevenue - totalHPP));
  const totalOrders = completedOrders.length;
  const pendingCount = filteredOrders.filter((o: any) => o.status === 'pending').length;
  const canceledCount = filteredOrders.filter((o: any) => o.status === 'cancelled').length;
  const avgOrderValue = totalOrders > 0 ? Math.round(netRevenue / totalOrders) : 0;

  const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty);
  const totalItemsSold = Object.values(itemMap).reduce((sum, item) => sum + item.qty, 0);

  let maxHourlyCount = 0;
  let peakHour: number | null = null;
  for (let i = 0; i < 24; i++) {
    if (hourly[i] > maxHourlyCount) {
      maxHourlyCount = hourly[i];
      peakHour = i;
    }
  }

  const analytics = {
    totalRevenue,
    totalDeductions,
    totalPlatformSubsidy,
    netRevenue,
    totalHPP,
    grossProfit,
    totalOrders,
    totalItemsSold,
    avgOrderValue,
    pendingCount,
    canceledCount,
    paymentBreakdown,
    hourly,
    peakHour,
    bestSellers,
    outletSalesMap,
  };

  const outlets = outletsData || [];

  return (
    <ReportsClient 
      analytics={analytics} 
      outlets={outlets} 
      initialFilters={{
        range,
        customStart,
        customEnd,
        channelFilter,
        paymentFilter,
        statusFilter,
        outletFilter: permittedOutletId
      }}
      isLockedOutlet={!!staff?.outlet_id}
    />
  );
}
