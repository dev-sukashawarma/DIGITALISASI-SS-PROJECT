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

  // Fetch Outlets for the filter dropdown
  let qOutlets = supabaseAdmin.from('outlets').select('id, name').eq('is_active', true).neq('id', TEST_OUTLET_ID);
  if (staff?.role === 'area_manager') {
    qOutlets = qOutlets.in('id', accessibleOutlets);
  } else if (staff?.outlet_id && !isFullAccess) {
    qOutlets = qOutlets.eq('id', staff.outlet_id);
  }

  const [posOrdersData, ecommerceSalesData, settlementsData, { data: outletsData }] = await Promise.all([
    permittedOutletId === 'ss-online' ? Promise.resolve([]) : fetchAllPages(buildOrdersQuery),
    shouldIncludeEcommerce ? fetchAllPages(buildEcommerceQuery) : Promise.resolve([]),
    fetchAllPages(buildSettlementsQuery),
    qOutlets,
  ]);

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

  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {};
  const hourly = Array(24).fill(0);
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  const outletSalesMap: Record<string, { itemsSold: number; items: Record<string, { name: string; qty: number; revenue: number }> }> = {};

  completedOrders.forEach((o: any) => {
    const outletId = o.outlet_id;
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

    // 4. Best Sellers (menggunakan cleanItemName seperti Admin)
    if (Array.isArray(o.order_items)) {
      o.order_items.forEach((oi: any) => {
        const name = cleanItemName(oi.menu_item_name) || 'Item';
        const qty = Number(oi.quantity) || 0;
        const sub = Number(oi.subtotal) || 0;

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
