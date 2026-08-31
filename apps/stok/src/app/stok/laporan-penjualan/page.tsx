import React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import LaporanPenjualanClient from './LaporanPenjualanClient';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export const dynamic = 'force-dynamic';

export default async function LaporanPenjualanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  // Role restriction: Khusus kitchen, purchasing, admin, owner
  if (staff && staff.role !== 'kitchen' && staff.role !== 'purchasing' && staff.role !== 'admin' && staff.role !== 'owner') {
    redirect('/dashboard');
  }

  const resolvedSearchParams = await searchParams;

  const range = (resolvedSearchParams.range as DateRange) || 'today';
  const customStart = (resolvedSearchParams.customStart as string) || '';
  const customEnd = (resolvedSearchParams.customEnd as string) || '';
  const channelFilter = (resolvedSearchParams.channel as string) || 'all';
  const outletFilter = (resolvedSearchParams.outlet_id as string) || 'all';

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Helper untuk boundary waktu Asia/Jakarta (WIB)
  const getJakartaBoundary = (offsetDays: number = 0, isStartOfDay: boolean = true) => {
    const jakartaStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const d = new Date(jakartaStr);
    d.setDate(d.getDate() + offsetDays);
    if (isStartOfDay) {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }

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

  let p_start = new Date();
  let p_end = new Date();

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
    p_start = getJakartaBoundary(0, true);
    p_end = getJakartaBoundary(0, false);
  }

  // Handle pagination untuk > 1000 orders
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
    .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, order_items(id, menu_item_name, quantity, subtotal)')
    .gte('created_at', p_start.toISOString())
    .lte('created_at', p_end.toISOString());

  // Channel filter
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

  // Outlet filter
  if (outletFilter !== 'all') {
    ordersQuery = ordersQuery.eq('outlet_id', outletFilter);
  }

  // Helper untuk memfilter outlet internal non-sales / test
  const isIgnoredOutletName = (name: string) => {
    if (!name) return true;
    const n = name.toUpperCase();
    return (
      n.includes('GUDANG PUSAT') ||
      n.includes('GEDUNG PUSAT') ||
      n.includes('KANTOR PUSAT') ||
      n.includes('OUTLET TES') ||
      n.includes('OUTLET TEST') ||
      n.includes('SHOOPE') ||
      n.includes('SHOPEE') ||
      n.includes('TIKTOK') ||
      n.includes('GLOBAL OUTLET') ||
      n.includes('GLOBAL SYSTEM')
    );
  };

  // Fetch Outlets & Orders
  const [ordersData, { data: outletsData }] = await Promise.all([
    fetchAllPages(ordersQuery),
    supabaseAdmin.from('outlets').select('id, name').eq('is_active', true).order('name', { ascending: true })
  ]);

  // Filter outlet valid (hanya outlet operasional fisik)
  const validOutlets = (outletsData || [])
    .filter(o => !isIgnoredOutletName(o.name))
    .map(o => {
      const isMitra = o.name.toUpperCase().includes('MITRA');
      const cleanName = o.name.replace('SUKA SHAWARMA ', '').trim();
      return {
        id: o.id,
        name: o.name,
        cleanName,
        category: isMitra ? ('mitra' as const) : ('internal' as const)
      };
    });

  const validOutletIdSet = new Set(validOutlets.map(o => o.id));
  const outletInfoMap = new Map<string, { name: string; cleanName: string; category: 'mitra' | 'internal' }>();
  validOutlets.forEach(o => {
    outletInfoMap.set(o.id, { name: o.name, cleanName: o.cleanName, category: o.category });
  });

  // Filter completed orders (hanya dari outlet valid jika filter outlet = 'all')
  const completedOrders = (ordersData || []).filter((o: any) => {
    if (o.status !== 'completed') return false;
    if (outletFilter === 'all' && o.outlet_id && !validOutletIdSet.has(o.outlet_id)) {
      return false; // Skip pesanan dari outlet tes/pusat/shopee dummy
    }
    return true;
  });
  const canceledOrders = (ordersData || []).filter((o: any) => o.status === 'cancelled');

  const netRevenue = completedOrders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
  const totalDeductions = completedOrders.reduce((s: number, o: any) => {
    return s + (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0);
  }, 0);
  const totalRevenue = netRevenue + totalDeductions;
  const totalOrders = completedOrders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(netRevenue / totalOrders) : 0;

  // Hourly Trend (Asia/Jakarta +7)
  const hourlyCounts = Array(24).fill(0);
  const hourlyRevenue = Array(24).fill(0);
  const hourlyPorsi = Array(24).fill(0);

  // Channel Breakdown
  const channelStats: Record<string, { label: string; count: number; revenue: number; porsi: number }> = {
    offline: { label: 'Offline / Kasir', count: 0, revenue: 0, porsi: 0 },
    gofood: { label: 'GoFood', count: 0, revenue: 0, porsi: 0 },
    grabfood: { label: 'GrabFood', count: 0, revenue: 0, porsi: 0 },
    shopeefood: { label: 'ShopeeFood', count: 0, revenue: 0, porsi: 0 },
    tiktok: { label: 'TikTok Shop', count: 0, revenue: 0, porsi: 0 },
    lainnya: { label: 'Lainnya', count: 0, revenue: 0, porsi: 0 }
  };

  // Best Sellers (Item Terjual)
  const itemMap: Record<string, { name: string; qty: number; revenue: number; orderCount: number }> = {};
  
  // Outlet Breakdown
  const outletStatsMap: Record<string, {
    outletId: string;
    outletName: string;
    category: 'mitra' | 'internal';
    totalRevenue: number;
    totalOrders: number;
    itemsSold: number;
    items: Record<string, number>;
  }> = {};

  completedOrders.forEach((o: any) => {
    const outletId = o.outlet_id || 'unknown';
    const info = outletInfoMap.get(outletId);
    const outletName = info?.cleanName || (outletId === 'unknown' ? 'Tanpa Outlet' : outletId.substring(0, 8));
    const category = info?.category || 'internal';

    if (!outletStatsMap[outletId]) {
      outletStatsMap[outletId] = {
        outletId,
        outletName,
        category,
        totalRevenue: 0,
        totalOrders: 0,
        itemsSold: 0,
        items: {}
      };
    }

    const orderAmount = Number(o.total_amount) || 0;
    outletStatsMap[outletId].totalRevenue += orderAmount;
    outletStatsMap[outletId].totalOrders += 1;

    // Channel Normalization
    let chKey = 'offline';
    const rawCh = (o.channel || '').toLowerCase();
    if (!rawCh || rawCh === 'offline' || rawCh === 'pos') {
      chKey = 'offline';
    } else if (rawCh.includes('gofood')) {
      chKey = 'gofood';
    } else if (rawCh.includes('grab')) {
      chKey = 'grabfood';
    } else if (rawCh.includes('shopee')) {
      chKey = 'shopeefood';
    } else if (rawCh.includes('tiktok')) {
      chKey = 'tiktok';
    } else {
      chKey = 'lainnya';
    }

    channelStats[chKey].count += 1;
    channelStats[chKey].revenue += orderAmount;

    // Hourly (WIB)
    const d = new Date(o.created_at);
    const hourWib = (d.getUTCHours() + 7) % 24;
    hourlyCounts[hourWib] += 1;
    hourlyRevenue[hourWib] += orderAmount;

    // Items
    if (Array.isArray(o.order_items)) {
      o.order_items.forEach((oi: any) => {
        let name = (oi.menu_item_name || 'Item Tanpa Nama').trim();
        if (name.includes('|')) {
          name = name.split('|')[0].trim();
        }

        const qty = Number(oi.quantity) || 0;
        const subtotal = Number(oi.subtotal) || 0;

        if (!itemMap[name]) {
          itemMap[name] = { name, qty: 0, revenue: 0, orderCount: 0 };
        }
        itemMap[name].qty += qty;
        itemMap[name].revenue += subtotal;
        itemMap[name].orderCount += 1;

        channelStats[chKey].porsi += qty;
        hourlyPorsi[hourWib] += qty;

        outletStatsMap[outletId].itemsSold += qty;
        outletStatsMap[outletId].items[name] = (outletStatsMap[outletId].items[name] || 0) + qty;
      });
    }
  });

  const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty);
  const totalItemsSold = bestSellers.reduce((sum, item) => sum + item.qty, 0);

  // Peak Hour
  let maxHourlyCount = 0;
  let peakHour: number | null = null;
  for (let i = 0; i < 24; i++) {
    if (hourlyCounts[i] > maxHourlyCount) {
      maxHourlyCount = hourlyCounts[i];
      peakHour = i;
    }
  }

  // Sorted Outlet Volume List
  const outletVolumeList = Object.values(outletStatsMap).sort((a, b) => b.itemsSold - a.itemsSold);

  const analytics = {
    totalRevenue,
    netRevenue,
    totalDeductions,
    totalOrders,
    totalItemsSold,
    avgOrderValue,
    canceledCount: canceledOrders.length,
    peakHour,
    hourly: hourlyCounts,
    hourlyRevenue,
    hourlyPorsi,
    channelStats,
    bestSellers,
    outletVolumeList
  };

  return (
    <LaporanPenjualanClient
      analytics={analytics}
      outlets={validOutlets}
      initialFilters={{
        range,
        customStart,
        customEnd,
        channelFilter,
        outletFilter
      }}
      staffName={staff?.name || 'Admin Kitchen'}
    />
  );
}
