export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ListChecks, Calendar } from 'lucide-react';
import RankingList from './RankingList';
import { CustomDateFilter } from '../components/CustomDateFilter';
import ZonePerformanceTable from '../components/ZonePerformanceTable';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import { presetRange, previousRange, type Preset } from '../lib/period';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatWIBTime = (tsServerStr: string) => {
  try {
    const d = new Date(tsServerStr)
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(':', '.') + ' WIB'
  } catch {
    return ''
  }
};

const getAMName = (outletId: string, outletName: string, amMap: Map<string, string>, staffRole?: string, staffName?: string) => {
  if (staffRole === 'area_manager') {
    return staffName || 'Area Anda';
  }
  
  if (amMap.has(outletId)) {
    return amMap.get(outletId)!;
  }

  const name = outletName.toUpperCase();
  
  if (name.includes('EMPANG') || name.includes('BCC') || name.includes('DRAMAGA') || name.includes('PALEDANG') || name.includes('CICURUG') || name.includes('CIMANGGU')) {
    return 'Abu Bakar';
  }
  if (name.includes('CIBINONG') || name.includes('CISEENG') || name.includes('SENTUL') || name.includes('PAJAJARAN')) {
    return 'Muchtar';
  }
  if (name.includes('SUKMAJAYA') || name.includes('BEJI') || name.includes('SAWANGAN') || name.includes('CIRENDEU') || name.includes('JAGAKARSA')) {
    return 'Chairul Rizky';
  }
  if (name.includes('KALISARI') || name.includes('CIBUBUR') || name.includes('CILENGSI') || name.includes('CILEUNGSI')) {
    return 'Tri Rizky';
  }
  if (name.includes('PEKAYON') || name.includes('JATIASIH') || name.includes('JATIWARINGIN')) {
    return 'Mulyadi';
  }
  
  return 'Lainnya';
};

const isIgnoredAM = (name: string) => {
  if (!name) return true;
  const n = name.toUpperCase();
  return n.includes('AREA MANAGER AM') || n.includes('TEST');
};

export default async function DashboardOverview(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const period = (searchParams?.period as string) || 'today';
  
  const cookieStore = await cookies();
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  let mainStartDate: string;
  let mainEndDate: string;
  let prevStartDate: string;
  let prevEndDate: string;

  if (period === 'custom') {
    const fromParam = searchParams?.from as string;
    const toParam = searchParams?.to as string;
    if (fromParam && toParam) {
      mainStartDate = fromParam;
      mainEndDate = toParam;
      const prev = previousRange({ from: fromParam, to: toParam });
      prevStartDate = prev.from;
      prevEndDate = prev.to;
    } else {
      const cur = presetRange('today');
      mainStartDate = cur.from;
      mainEndDate = cur.to;
      const prev = previousRange(cur);
      prevStartDate = prev.from;
      prevEndDate = prev.to;
    }
  } else {
    const validPreset: Preset = (['today', 'yesterday', 'week', 'month', '7d', '30d', 'this_month'].includes(period)
      ? period
      : 'today') as Preset;
    const cur = presetRange(validPreset);
    mainStartDate = cur.from;
    mainEndDate = cur.to;
    const prev = previousRange(cur);
    prevStartDate = prev.from;
    prevEndDate = prev.to;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Supabase PostgREST max-rows default = 1000, cannot be overridden by .limit().
  // Use manual pagination with .range() to fetch all rows beyond that limit deterministically.
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

  let qOutlets = supabaseAdmin.from('outlets').select('id, name, is_active, region, type').order('name');

  let qOrdersToday = supabaseAdmin
    .from('orders')
    .select('id, outlet_id, total_amount, order_items(quantity)')
    .gte('created_at', `${mainStartDate}T00:00:00+07:00`)
    .lte('created_at', `${mainEndDate}T23:59:59.999+07:00`)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  let qOrdersYesterday = supabaseAdmin
    .from('orders')
    .select('id, outlet_id, total_amount, order_items(quantity)')
    .gte('created_at', `${prevStartDate}T00:00:00+07:00`)
    .lte('created_at', `${prevEndDate}T23:59:59.999+07:00`)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  let qAttendance = supabaseAdmin.from('attendance')
    .select('outlet_id, ts_server, type, outlet_staff_id')
    .gte('ts_server', `${mainEndDate}T00:00:00+07:00`)
    .lte('ts_server', `${mainEndDate}T23:59:59.999+07:00`)
    .eq('type', 'in')
    .order('ts_server', { ascending: true });

  let qStaffOutlets = supabaseAdmin.from('staff_outlets')
    .select('outlet_id, staff_id, outlet_staff(name, role, is_active)')
    .order('staff_id');

  let accessibleOutlets: string[] = [];
  if (staff?.role === 'area_manager') {
    const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
    if (so && so.length > 0) {
      accessibleOutlets = so.map((s: any) => s.outlet_id);
    } else {
      accessibleOutlets = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  const filterOutletId = searchParams?.outlet_id as string | undefined;

  if (staff?.role === 'area_manager') {
    if (filterOutletId && filterOutletId !== 'all' && accessibleOutlets.includes(filterOutletId)) {
      qOrdersToday = qOrdersToday.eq('outlet_id', filterOutletId);
      qOrdersYesterday = qOrdersYesterday.eq('outlet_id', filterOutletId);
      qOutlets = qOutlets.eq('id', filterOutletId);
      qAttendance = qAttendance.eq('outlet_id', filterOutletId);
      qStaffOutlets = qStaffOutlets.eq('outlet_id', filterOutletId);
    } else {
      qOrdersToday = qOrdersToday.in('outlet_id', accessibleOutlets);
      qOrdersYesterday = qOrdersYesterday.in('outlet_id', accessibleOutlets);
      qOutlets = qOutlets.in('id', accessibleOutlets);
      qAttendance = qAttendance.in('outlet_id', accessibleOutlets);
      qStaffOutlets = qStaffOutlets.in('outlet_id', accessibleOutlets);
    }
  } else if (!staff || staff.role === 'regional_manager') {
    if (filterOutletId && filterOutletId !== 'all') {
      qOrdersToday = qOrdersToday.eq('outlet_id', filterOutletId);
      qOrdersYesterday = qOrdersYesterday.eq('outlet_id', filterOutletId);
      qOutlets = qOutlets.eq('id', filterOutletId);
      qAttendance = qAttendance.eq('outlet_id', filterOutletId);
      qStaffOutlets = qStaffOutlets.eq('outlet_id', filterOutletId);
    }
  } else if (staff?.outlet_id) {
    qOrdersToday = qOrdersToday.eq('outlet_id', staff.outlet_id);
    qOrdersYesterday = qOrdersYesterday.eq('outlet_id', staff.outlet_id);
    qOutlets = qOutlets.eq('id', staff.outlet_id);
    qAttendance = qAttendance.eq('outlet_id', staff.outlet_id);
    qStaffOutlets = qStaffOutlets.eq('outlet_id', staff.outlet_id);
  }

  const [
    ordersToday,
    ordersYesterday,
    { data: outlets },
    { data: attendanceToday },
    { data: staffOutlets }
  ] = await Promise.all([
    fetchAllPages(qOrdersToday),
    fetchAllPages(qOrdersYesterday),
    qOutlets,
    qAttendance,
    qStaffOutlets
  ]);

  // Samakan dengan kartu "Gross Revenue" di laporan POS Admin:
  // omzet adalah SUM(total_amount) seluruh order completed. HPP dan potongan
  // hanya digunakan untuk Gross Profit, sehingga tidak dikurangkan di sini.
  const getOrderGrossRevenue = (o: any) => Number(o.total_amount) || 0;

  const omzetToday = (ordersToday || []).reduce((sum, o) => sum + getOrderGrossRevenue(o), 0);
  const txToday = (ordersToday || []).length;
  const omzetYesterday = (ordersYesterday || []).reduce((sum, o) => sum + getOrderGrossRevenue(o), 0);

  const itemsSoldToday = (ordersToday || []).reduce((sum, order) => {
    const items = order.order_items || [];
    // @ts-ignore
    return sum + items.reduce((s, item) => s + (Number(item.quantity) || 0), 0);
  }, 0);

  let percentageChange = 0;
  if (omzetYesterday === 0) {
    percentageChange = omzetToday > 0 ? 100 : 0;
  } else {
    percentageChange = ((omzetToday - omzetYesterday) / omzetYesterday) * 100;
  }

  const isPositive = percentageChange >= 0;
  const absChange = Math.abs(percentageChange).toFixed(1);

  const allOutlets = (outlets || []).sort((a, b) => {
    const isAMitra = a.name.toUpperCase().startsWith('MITRA');
    const isBMitra = b.name.toUpperCase().startsWith('MITRA');
    if (isAMitra && !isBMitra) return 1;
    if (!isAMitra && isBMitra) return -1;
    return a.name.localeCompare(b.name);
  });

  const outletFirstCheckIn = new Map<string, string>();
  
  (attendanceToday || []).forEach(att => {
    if (!outletFirstCheckIn.has(att.outlet_id)) {
      // @ts-ignore
      const wibTime = new Date(att.ts_server).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
      outletFirstCheckIn.set(att.outlet_id, wibTime);
    }
  });

  const outletOmzetMap = new Map<string, number>();
  (ordersToday || []).forEach(o => {
    const current = outletOmzetMap.get(o.outlet_id) || 0;
    outletOmzetMap.set(o.outlet_id, current + getOrderGrossRevenue(o));
  });

  const amMap = new Map<string, string>();
  if (staffOutlets) {
    staffOutlets.forEach((so: any) => {
      if (so.outlet_staff && so.outlet_staff.role === 'area_manager' && so.outlet_staff.is_active !== false) {
        amMap.set(so.outlet_id, so.outlet_staff.name);
      }
    });
  }

  const activeOutlets = (outlets || []).filter(o => o.is_active);

  const outletRanking = activeOutlets
    .map(outlet => ({
      id: outlet.id,
      name: outlet.name,
      amName: getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name),
      omzet: outletOmzetMap.get(outlet.id) || 0
    }))
    .filter(o => !isIgnoredAM(o.amName))
    .sort((a, b) => b.omzet - a.omzet);

  const maxOmzet = outletRanking.length > 0 ? outletRanking[0].omzet : 1;

  const groupedOutlets = new Map<string, any[]>();
  allOutlets.forEach(outlet => {
    const amName = getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name);
    if (isIgnoredAM(amName)) return;
    
    const groupKey = amName;
    if (!groupedOutlets.has(groupKey)) {
      groupedOutlets.set(groupKey, []);
    }
    groupedOutlets.get(groupKey)!.push(outlet);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 🌟 Header Section & Segmented Filter Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-suka-brown tracking-tight">Ringkasan Area</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-suka-orange/10 text-suka-orange border border-suka-orange/20">
              USER: {staff?.role ? staff.role.replace('_', ' ').toUpperCase() : 'REGIONAL MANAGER'}
            </span>
          </div>
          <p className="text-xs font-semibold text-suka-gray-400 mt-1">
            Pantau performa pendapatan, transaksi, dan aktivitas cabang secara real-time
          </p>
        </div>

        {/* Segmented Filter Control */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-suka-brown/[0.04] rounded-2xl p-1 border border-suka-brown/10 shrink-0">
          <Link href="?period=today" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'today' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>Hari Ini</Link>
          <Link href="?period=yesterday" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'yesterday' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>Kemarin</Link>
          <Link href="?period=week" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'week' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>7 Hari</Link>
          <Link href="?period=month" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'month' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>30 Hari</Link>
          <CustomDateFilter />
        </div>
      </div>
      
      {/* 📊 Metrics Grid (Bento KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* KPI 1: Pendapatan */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-suka-orange/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Gross Revenue</h3>
            <div className="p-2.5 bg-suka-orange/10 text-suka-orange rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
            {formatRupiah(omzetToday)}
          </p>
          <div className="mt-3">
            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
              isPositive ? 'text-emerald-800 bg-emerald-100/80 border border-emerald-200' : 'text-red-700 bg-red-100/80 border border-red-200'
            }`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositive ? '+' : '-'}{absChange}% dari periode sebelumnya
            </span>
          </div>
        </div>
        
        {/* KPI 2: Jumlah Transaksi */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Jumlah Transaksi</h3>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
            {txToday} <span className="text-sm font-bold text-suka-gray-400">order</span>
          </p>
          <div className="mt-3">
            <span className="text-[10px] font-extrabold text-suka-brown/60 bg-suka-brown/5 px-2.5 py-1 rounded-full border border-suka-brown/10 inline-block">
              Selesai pada periode ini
            </span>
          </div>
        </div>

        {/* KPI 3: Jumlah Item Terjual */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Jumlah Item Terjual</h3>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <ListChecks size={20} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
            {itemsSoldToday} <span className="text-sm font-bold text-suka-gray-400">porsi</span>
          </p>
          <div className="mt-3">
            <span className="text-[10px] font-extrabold text-suka-brown/60 bg-suka-brown/5 px-2.5 py-1 rounded-full border border-suka-brown/10 inline-block">
              Total Produk pada periode ini
            </span>
          </div>
        </div>
      </div>
      
      {/* 🏢 Zone Performance Monitoring Table for Regional Manager */}
      {(() => {
        if (staff?.role === 'area_manager') return null;

        const zonePerformanceMap = new Map<string, { outlets: { id: string; name: string; omzet: number }[]; totalOmzet: number }>();

        activeOutlets.forEach(outlet => {
          const amName = getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name);
          if (isIgnoredAM(amName)) return;

          const omzet = outletOmzetMap.get(outlet.id) || 0;
          if (!zonePerformanceMap.has(amName)) {
            zonePerformanceMap.set(amName, { outlets: [], totalOmzet: 0 });
          }
          const zData = zonePerformanceMap.get(amName)!;
          zData.outlets.push({ id: outlet.id, name: outlet.name, omzet });
          zData.totalOmzet += omzet;
        });

        const zonePerformanceData = Array.from(zonePerformanceMap.entries())
          .map(([zoneName, data]) => ({
            zoneName,
            outlets: data.outlets,
            totalOmzet: data.totalOmzet
          }))
          .sort((a, b) => b.totalOmzet - a.totalOmzet);

        return <ZonePerformanceTable zones={zonePerformanceData} />;
      })()}
      
      {/* 🏆 Bottom Grid: Leaderboard & Operational Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Leaderboard Ranking */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 lg:col-span-2 min-h-[300px]">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-suka-brown/10">
            <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider">
              Ranking Outlet (Berdasarkan Gross Revenue)
            </h3>
            <span className="text-xs font-bold text-suka-gray-400">
              {outletRanking.length} Outlet Terdaftar
            </span>
          </div>
          <RankingList outletRanking={outletRanking} maxOmzet={maxOmzet} />
        </div>

        {/* Live Outlet Status Feed */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 min-h-[300px] lg:col-span-1">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-suka-brown/10">
            <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider">
              Status Outlet
            </h3>
            <span className="text-xs font-bold text-suka-gray-400">
              {allOutlets.length} Cabang
            </span>
          </div>

          {allOutlets.length === 0 ? (
            <p className="text-sm text-suka-gray-400">Tidak ada outlet.</p>
          ) : (
            <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
              {Array.from(groupedOutlets.entries()).map(([groupKey, groupOutlets]) => (
                <div key={groupKey} className="space-y-3">
                  {groupedOutlets.size > 1 && (
                    <h4 className="text-[11px] font-black text-suka-orange uppercase tracking-wider bg-suka-orange/10 px-3 py-1.5 rounded-lg inline-block border border-suka-orange/20">
                      {groupKey}
                    </h4>
                  )}
                  <ul className="divide-y divide-suka-brown/5">
                    {groupOutlets.map(outlet => {
                      const isOpen = outletFirstCheckIn.has(outlet.id);
                      const openTime = outletFirstCheckIn.get(outlet.id);

                      return (
                        <li key={outlet.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0 hover:bg-suka-brown/[0.02] px-2 rounded-xl transition-colors">
                          <span className="text-sm font-extrabold text-suka-brown truncate mr-2">{outlet.name}</span>
                          {isOpen ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] rounded-full font-black uppercase tracking-wider border border-emerald-200 shrink-0">
                              <span className="relative flex h-2 w-2 mr-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              Buka - {openTime}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] rounded-full font-black uppercase tracking-wider border border-red-200 shrink-0">
                              Tutup
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
