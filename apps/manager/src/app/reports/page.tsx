import React from 'react';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import ReportsClient from './ReportsClient';
import { TEST_OUTLET_ID } from '@/lib/outletFilters';
import { cleanItemName } from '@/lib/order-item-name';
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

  const [posOrdersData, ecommerceSalesData, settlementsData, { data: outletsData }, { data: menuItemsData }, { data: riwayatHppData }] = await Promise.all([
    permittedOutletId === 'ss-online' ? Promise.resolve([]) : fetchAllPages(buildOrdersQuery),
    shouldIncludeEcommerce ? fetchAllPages(buildEcommerceQuery) : Promise.resolve([]),
    fetchAllPages(buildSettlementsQuery),
    qOutlets,
    supabaseAdmin
      .from('menu_items')
      .select(
        'id, name, hpp_override, channel_hpp, is_package, package_items:menu_package_items!menu_package_items_package_menu_id_fkey(quantity, component:menu_items!menu_package_items_component_menu_id_fkey(id, name, hpp_override, channel_hpp))'
      ),
    supabaseAdmin
      .from('menu_hpp_riwayat')
      .select('menu_id, berlaku_mulai, hpp_override, channel_hpp')
      .order('berlaku_mulai', { ascending: true }),
  ]);

  const outletTypeMap = new Map<string, string>();
  for (const o of outletsData || []) {
    if (o.id) outletTypeMap.set(o.id, String(o.type || 'internal').toLowerCase());
  }

  const riwayatByMenu = new Map<string, any[]>();
  for (const r of riwayatHppData || []) {
    if (!r?.menu_id || !r?.berlaku_mulai) continue;
    const list = riwayatByMenu.get(r.menu_id);
    if (list) list.push(r);
    else riwayatByMenu.set(r.menu_id, [r]);
  }
  for (const list of riwayatByMenu.values()) {
    list.sort((a: any, b: any) => (a.berlaku_mulai < b.berlaku_mulai ? -1 : a.berlaku_mulai > b.berlaku_mulai ? 1 : 0));
  }

  const cachePenerapTanggal = new Map<string, { byId: Map<string, any>; byName: Map<string, any> }>();
  const getPenerapUntukTanggal = (tgl: string) => {
    const cached = cachePenerapTanggal.get(tgl);
    if (cached) return cached;
    const pilihBaris = (menuId?: string) => {
      if (!menuId) return undefined;
      const list = riwayatByMenu.get(menuId);
      if (!list || list.length === 0) return undefined;
      let kandidat: any = undefined;
      for (const b of list) {
        if (b.berlaku_mulai <= tgl) kandidat = b;
        else break;
      }
      return kandidat ?? list[0];
    };
    const timpa = (m: any): any => {
      if (!m || typeof m !== 'object') return m;
      const r = pilihBaris(m.id);
      const next: any = r ? { ...m, hpp_override: r.hpp_override, channel_hpp: r.channel_hpp ?? {} } : { ...m };
      if (Array.isArray(m.package_items)) {
        next.package_items = m.package_items.map((pi: any) =>
          pi?.component ? { ...pi, component: timpa(pi.component) } : pi
        );
      }
      return next;
    };
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const m of menuItemsData || []) {
      const t = timpa(m);
      if (m?.id) byId.set(m.id, t);
      if (m?.name) byName.set(cleanItemName(m.name), t);
    }
    const res = { byId, byName };
    cachePenerapTanggal.set(tgl, res);
    return res;
  };

  const hitungHppItem = (
    menuItem: any,
    outletType?: string,
    fallbackName?: string,
    byName?: Map<string, any>,
    channel?: string | null,
    menuItemId?: string | null,
    byId?: Map<string, any>
  ): number => {
    let itemObj = menuItem;
    if (!itemObj && menuItemId && byId?.has(menuItemId)) itemObj = byId.get(menuItemId);
    if ((!itemObj || (!itemObj.hpp_override && !itemObj.channel_hpp && !itemObj.is_package)) && fallbackName && byName) {
      const cleanKey = cleanItemName(fallbackName);
      if (byName.has(cleanKey)) itemObj = byName.get(cleanKey);
    }
    if (!itemObj) return 0;
    const normCh = channel ? channel.toLowerCase() : null;
    const isMitra = outletType === 'mitra';
    let baseHpp = 0;
    let channelHppVal: number | null = null;
    if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
      channelHppVal = itemObj.channel_hpp[normCh] ?? null;
    }
    if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
      baseHpp = Number(channelHppVal);
    } else if (itemObj.hpp_override !== null && itemObj.hpp_override !== undefined && Number(itemObj.hpp_override) > 0) {
      baseHpp = Number(itemObj.hpp_override);
    } else if (itemObj.is_package && Array.isArray(itemObj.package_items)) {
      baseHpp = itemObj.package_items.reduce((sum: number, pkg: any) => {
        const compHpp = pkg.component ? hitungHppItem(pkg.component, undefined, undefined, undefined, channel) : 0;
        const qty = pkg.quantity || 1;
        return sum + compHpp * qty;
      }, 0);
    }
    return isMitra && baseHpp > 0 ? Math.round(baseHpp * 1.1) : baseHpp;
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
        const unitHpp = hitungHppItem(menuItem, outType, name, penerap.byName, ordChannel, oi.menu_item_id, penerap.byId);
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
