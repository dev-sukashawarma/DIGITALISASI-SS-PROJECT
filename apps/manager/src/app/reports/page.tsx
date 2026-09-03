import React from 'react';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import ReportsClient from './ReportsClient';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

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

  // Calculate Date Boundaries
  let p_start = new Date();
  let p_end = new Date();
  
  // Use UTC times for DB query, we want Jakarta +7 equivalent
  // Actually, pos-kasir uses local times, since the server might be in UTC, we need to handle timezone carefully.
  // We'll stick to a simple approach, but assuming server is UTC, we might want to offset to Jakarta (UTC+7).
  // For now, let's replicate the pos-kasir logic exactly, which depends on server local time (or Node's timezone).
  // Wait, Manager is Next.js. We should create dates in UTC representing Jakarta time.
  // Actually, Vercel edge/serverless is usually UTC. So new Date() gets UTC. 
  
  // A helper to get start of day in Jakarta
  const getJakartaBoundary = (offsetDays: number = 0, isStartOfDay: boolean = true) => {
    // Create a string representing current Jakarta time
    const jakartaStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"});
    const d = new Date(jakartaStr);
    d.setDate(d.getDate() + offsetDays);
    if (isStartOfDay) {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
    
    // We need to construct a Date object that is exactly this time in UTC+7
    // A robust way in JS is to build the ISO string manually:
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const MM = pad(d.getMinutes());
    const SS = pad(d.getSeconds());
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    
    return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}.${ms}+07:00`);
  };

  if (range === 'today') {
    p_start = getJakartaBoundary(0, true);
    p_end = getJakartaBoundary(0, false);
  } else if (range === 'yesterday') {
    p_start = getJakartaBoundary(-1, true);
    p_end = getJakartaBoundary(-1, false);
  } else if (range === '7days') {
    p_start = getJakartaBoundary(-6, true);
    p_end = getJakartaBoundary(0, false);
  } else if (range === '30days') {
    p_start = getJakartaBoundary(-29, true);
    p_end = getJakartaBoundary(0, false);
  } else if (range === 'all') {
    p_start = new Date(0);
    p_end = getJakartaBoundary(0, false);
  } else if (range === 'custom' && customStart && customEnd) {
    p_start = new Date(customStart + 'T00:00:00+07:00');
    p_end = new Date(customEnd + 'T23:59:59+07:00');
  } else {
    // Default today
    p_start = getJakartaBoundary(0, true);
    p_end = getJakartaBoundary(0, false);
  }

  // Supabase PostgREST max-rows default = 1000, cannot be overridden by .limit().
  // Use manual pagination with .range() to fetch all rows beyond that limit.
  const fetchAllPages = async (baseQuery: any): Promise<any[]> => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await baseQuery.range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  let ordersQuery = supabaseAdmin
    .from('orders')
    .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, voided_by, void_reason, cancellation_reason, outlet_id, order_items(id, menu_item_name, quantity, subtotal)')
    .gte('created_at', p_start.toISOString())
    .lte('created_at', p_end.toISOString());

  // Apply filters
  if (statusFilter !== 'all') {
    ordersQuery = ordersQuery.eq('status', statusFilter);
  }
  if (paymentFilter !== 'all') {
    ordersQuery = ordersQuery.eq('payment_method', paymentFilter);
  }
  if (channelFilter !== 'all') {
    if (channelFilter === 'offline') {
      ordersQuery = ordersQuery.is('channel', null);
    } else if (channelFilter === 'food_apps') {
      ordersQuery = ordersQuery.in('channel', ['gofood', 'grabfood', 'shopeefood', 'tiktokgo', 'tiktok', 'tiktok_go']);
    } else if (channelFilter === 'tiktokgo' || channelFilter === 'tiktok') {
      ordersQuery = ordersQuery.in('channel', ['tiktokgo', 'tiktok', 'tiktok_go']);
    } else {
      ordersQuery = ordersQuery.eq('channel', channelFilter);
    }
  }

  let accessibleOutlets: string[] = [];
  if (staff?.role === 'area_manager') {
    const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
    if (so && so.length > 0) {
      accessibleOutlets = so.map((s: any) => s.outlet_id);
    } else {
      accessibleOutlets = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  // Handle Outlet Filter
  let permittedOutletId = outletFilter;
  
  if (staff?.role === 'area_manager') {
    if (permittedOutletId !== 'all' && accessibleOutlets.includes(permittedOutletId)) {
       ordersQuery = ordersQuery.eq('outlet_id', permittedOutletId);
    } else {
       ordersQuery = ordersQuery.in('outlet_id', accessibleOutlets);
    }
  } else if (!staff || staff.role === 'regional_manager') {
    if (permittedOutletId !== 'all') {
      ordersQuery = ordersQuery.eq('outlet_id', permittedOutletId);
    }
  } else if (staff?.outlet_id) {
    ordersQuery = ordersQuery.eq('outlet_id', staff.outlet_id);
  }

  // Fetch Outlets for the filter dropdown
  let qOutlets = supabaseAdmin.from('outlets').select('id, name').eq('is_active', true);
  if (staff?.role === 'area_manager') {
    qOutlets = qOutlets.in('id', accessibleOutlets);
  } else if (staff?.outlet_id && staff.role !== 'regional_manager') {
    qOutlets = qOutlets.eq('id', staff.outlet_id);
  }

  const [ordersData, { data: outletsData }] = await Promise.all([
    fetchAllPages(ordersQuery),
    qOutlets
  ]);

  // Aggregate the data
  const completedOrders = (ordersData || []).filter((o: any) => o.status === 'completed');

  // total_amount tersimpan SUDAH net (checkout/walk-in/manual sudah mengurangi
  // discount_amount & promo_subsidy sebelum insert) — jangan dikurangi lagi di sini.
  const netRevenue = completedOrders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);

  // Total Potongan: hanya deduksi yang benar-benar tercatat di order (diskon order-level
  // & subsidi promo Food Apps). Diskon per-item yang dibakar langsung ke unit_price saat
  // checkout tidak tercatat di kolom manapun, jadi tidak bisa direkonstruksi di sini.
  const totalDeductions = completedOrders.reduce((s: number, o: any) => {
    return s + (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0);
  }, 0);

  // Samakan dengan POS Kasir: omzet adalah netRevenue (SUM(total_amount) pesanan completed)
  const totalRevenue = netRevenue;
  const totalOrders = completedOrders.length;
  const pendingCount = (ordersData || []).filter((o: any) => o.status === 'pending').length;
  const canceledCount = (ordersData || []).filter((o: any) => o.status === 'cancelled').length;
  const avgOrderValue = totalOrders > 0 ? Math.round(netRevenue / totalOrders) : 0;

  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {};
  const hourly = Array(24).fill(0);
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  const outletSalesMap: Record<string, { itemsSold: number, items: Record<string, { name: string, qty: number, revenue: number }> }> = {};

  completedOrders.forEach((o: any) => {
    const outletId = o.outlet_id;
    if (outletId) {
      if (!outletSalesMap[outletId]) outletSalesMap[outletId] = { itemsSold: 0, items: {} };
    }

    // Payment Breakdown
    const pm = o.payment_method || 'unknown';
    if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, revenue: 0 };
    paymentBreakdown[pm].count++;
    paymentBreakdown[pm].revenue += Number(o.total_amount) || 0;

    // Hourly (Asia/Jakarta +7)
    const d = new Date(o.created_at);
    const h = (d.getUTCHours() + 7) % 24;
    hourly[h]++;

    // Best Sellers
    if (Array.isArray(o.order_items)) {
      o.order_items.forEach((oi: any) => {
        let name = oi.menu_item_name || 'Item';
        if (name.includes('|')) {
          name = name.split('|')[0].trim();
        }
        
        const qty = Number(oi.quantity) || 0;
        if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
        itemMap[name].qty += qty;
        itemMap[name].revenue += Number(oi.subtotal) || 0;
        
        if (outletId) {
          outletSalesMap[outletId].itemsSold += qty;
          if (!outletSalesMap[outletId].items[name]) {
            outletSalesMap[outletId].items[name] = { name, qty: 0, revenue: 0 };
          }
          outletSalesMap[outletId].items[name].qty += qty;
          outletSalesMap[outletId].items[name].revenue += Number(oi.subtotal) || 0;
        }
      });
    }
  });

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
