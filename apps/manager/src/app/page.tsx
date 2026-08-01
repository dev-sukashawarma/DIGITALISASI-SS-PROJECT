import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ListChecks, Calendar } from 'lucide-react';
import RankingList from './RankingList';
import { CustomDateFilter } from '../components/CustomDateFilter';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getJakartaDateString = (date: Date) => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
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

const getAMName = (outletName: string) => {
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

export default async function DashboardOverview(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const period = (searchParams?.period as string) || 'today';
  
  const cookieStore = await cookies();
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  });

  const now = new Date();
  const todayStr = getJakartaDateString(now);
  
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getJakartaDateString(yesterdayDate);

  const dayBeforeYesterdayDate = new Date(yesterdayDate);
  dayBeforeYesterdayDate.setDate(dayBeforeYesterdayDate.getDate() - 1);
  const dayBeforeYesterdayStr = getJakartaDateString(dayBeforeYesterdayDate);
  
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = getJakartaDateString(lastMonthDate);

  let mainStartDate = todayStr;
  let mainEndDate = todayStr;
  let prevStartDate = yesterdayStr;
  let prevEndDate = yesterdayStr;
  
  if (period === 'yesterday') {
    mainStartDate = yesterdayStr;
    mainEndDate = yesterdayStr;
    prevStartDate = dayBeforeYesterdayStr;
    prevEndDate = dayBeforeYesterdayStr;
  } else if (period === 'week') {
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(lastWeekDate.getDate() - 6);
    mainStartDate = getJakartaDateString(lastWeekDate);
    mainEndDate = todayStr;
    
    const prevWeekEndDate = new Date(lastWeekDate);
    prevWeekEndDate.setDate(prevWeekEndDate.getDate() - 1);
    const prevWeekStartDate = new Date(prevWeekEndDate);
    prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 6);
    
    prevStartDate = getJakartaDateString(prevWeekStartDate);
    prevEndDate = getJakartaDateString(prevWeekEndDate);
  } else if (period === 'month') {
    mainStartDate = lastMonthStr;
    mainEndDate = todayStr;
    
    const prevMonthDateEnd = new Date(lastMonthDate);
    prevMonthDateEnd.setDate(prevMonthDateEnd.getDate() - 1);
    const prevMonthDateStart = new Date(prevMonthDateEnd);
    prevMonthDateStart.setMonth(prevMonthDateStart.getMonth() - 1);
    
    prevStartDate = getJakartaDateString(prevMonthDateStart);
    prevEndDate = getJakartaDateString(prevMonthDateEnd);
  } else if (period === 'custom') {
    const fromParam = searchParams?.from as string;
    const toParam = searchParams?.to as string;
    if (fromParam && toParam) {
      mainStartDate = fromParam;
      mainEndDate = toParam;
      
      const dFrom = new Date(fromParam);
      const dTo = new Date(toParam);
      const diffTime = Math.abs(dTo.getTime() - dFrom.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const prevEndDateDate = new Date(dFrom);
      prevEndDateDate.setDate(prevEndDateDate.getDate() - 1);
      
      const prevStartDateDate = new Date(prevEndDateDate);
      prevStartDateDate.setDate(prevStartDateDate.getDate() - diffDays);

      prevStartDate = getJakartaDateString(prevStartDateDate);
      prevEndDate = getJakartaDateString(prevEndDateDate);
    }
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let qToday = supabaseAdmin.from('sales_hourly_spv')
    .select('outlet_id, omzet, jumlah_order_completed')
    .gte('sales_date', mainStartDate)
    .lte('sales_date', mainEndDate);

  let qYesterday = supabaseAdmin.from('sales_hourly_spv')
    .select('omzet')
    .gte('sales_date', prevStartDate)
    .lte('sales_date', prevEndDate);

  let qOutlets = supabaseAdmin.from('outlets').select('id, name, is_active, region');
  
  let qOrders = supabaseAdmin
    .from('orders')
    .select('id, outlet_id, order_items(quantity)')
    .gte('created_at', new Date(`${mainStartDate}T00:00:00+07:00`).toISOString())
    .lte('created_at', new Date(`${mainEndDate}T23:59:59+07:00`).toISOString())
    .eq('status', 'completed');

  let qAttendance = supabaseAdmin.from('attendance')
    .select('outlet_id, ts_server, type, outlet_staff_id')
    .gte('ts_server', new Date(`${mainEndDate}T00:00:00+07:00`).toISOString())
    .lte('ts_server', new Date(`${mainEndDate}T23:59:59+07:00`).toISOString())
    .eq('type', 'in')
    .order('ts_server', { ascending: true });

  let qStaffOutlets = supabaseAdmin.from('staff_outlets')
    .select('outlet_id, outlet_staff(name, role)');

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
      qToday = qToday.eq('outlet_id', filterOutletId);
      qYesterday = qYesterday.eq('outlet_id', filterOutletId);
      qOutlets = qOutlets.eq('id', filterOutletId);
      qOrders = qOrders.eq('outlet_id', filterOutletId);
      qAttendance = qAttendance.eq('outlet_id', filterOutletId);
      qStaffOutlets = qStaffOutlets.eq('outlet_id', filterOutletId);
    } else {
      qToday = qToday.in('outlet_id', accessibleOutlets);
      qYesterday = qYesterday.in('outlet_id', accessibleOutlets);
      qOutlets = qOutlets.in('id', accessibleOutlets);
      qOrders = qOrders.in('outlet_id', accessibleOutlets);
      qAttendance = qAttendance.in('outlet_id', accessibleOutlets);
      qStaffOutlets = qStaffOutlets.in('outlet_id', accessibleOutlets);
    }
  } else if (!staff || staff.role === 'regional_manager') {
    if (filterOutletId && filterOutletId !== 'all') {
      qToday = qToday.eq('outlet_id', filterOutletId);
      qYesterday = qYesterday.eq('outlet_id', filterOutletId);
      qOutlets = qOutlets.eq('id', filterOutletId);
      qOrders = qOrders.eq('outlet_id', filterOutletId);
      qAttendance = qAttendance.eq('outlet_id', filterOutletId);
      qStaffOutlets = qStaffOutlets.eq('outlet_id', filterOutletId);
    }
  } else if (staff?.outlet_id) {
    qToday = qToday.eq('outlet_id', staff.outlet_id);
    qYesterday = qYesterday.eq('outlet_id', staff.outlet_id);
    qOutlets = qOutlets.eq('id', staff.outlet_id);
    qOrders = qOrders.eq('outlet_id', staff.outlet_id);
    qAttendance = qAttendance.eq('outlet_id', staff.outlet_id);
    qStaffOutlets = qStaffOutlets.eq('outlet_id', staff.outlet_id);
  }

  const [
    { data: salesToday },
    { data: salesYesterday },
    { data: outlets },
    { data: ordersToday },
    { data: attendanceToday },
    { data: staffOutlets }
  ] = await Promise.all([
    qToday,
    qYesterday,
    qOutlets,
    qOrders,
    qAttendance,
    qStaffOutlets
  ]);

  const omzetToday = (salesToday || []).reduce((sum, r) => sum + Number(r.omzet), 0);
  const txToday = (salesToday || []).reduce((sum, r) => sum + Number(r.jumlah_order_completed), 0);
  const omzetYesterday = (salesYesterday || []).reduce((sum, r) => sum + Number(r.omzet), 0);
  
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
  (salesToday || []).forEach(sale => {
    const current = outletOmzetMap.get(sale.outlet_id) || 0;
    outletOmzetMap.set(sale.outlet_id, current + Number(sale.omzet));
  });

  const outletRanking = (outlets || [])
    .filter(o => o.is_active)
    .map(outlet => ({
      id: outlet.id,
      name: outlet.name,
      amName: getAMName(outlet.name),
      omzet: outletOmzetMap.get(outlet.id) || 0
    }))
    .filter(o => o.amName !== 'Lainnya')
    .sort((a, b) => b.omzet - a.omzet);

  const maxOmzet = outletRanking.length > 0 ? outletRanking[0].omzet : 1;

  const groupedOutlets = new Map<string, any[]>();
  allOutlets.forEach(outlet => {
    const amName = getAMName(outlet.name);
    if (amName === 'Lainnya') return;
    
    const groupKey = amName;
    if (!groupedOutlets.has(groupKey)) {
      groupedOutlets.set(groupKey, []);
    }
    groupedOutlets.get(groupKey)!.push(outlet);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Ringkasan Area</h2>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-suka-brown/10 self-stretch sm:self-auto">
          <Link href="?period=today" className={`px-4 py-1.5 text-sm font-bold rounded-md flex-1 text-center transition-colors ${period === 'today' ? 'bg-suka-orange text-white' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}>Hari Ini</Link>
          <Link href="?period=yesterday" className={`px-4 py-1.5 text-sm font-bold rounded-md flex-1 text-center transition-colors ${period === 'yesterday' ? 'bg-suka-orange text-white' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}>Kemarin</Link>
          <Link href="?period=week" className={`px-4 py-1.5 text-sm font-bold rounded-md flex-1 text-center transition-colors ${period === 'week' ? 'bg-suka-orange text-white' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}>7 Hari Terakhir</Link>
          <Link href="?period=month" className={`px-4 py-1.5 text-sm font-bold rounded-md flex-1 text-center transition-colors ${period === 'month' ? 'bg-suka-orange text-white' : 'text-suka-gray-500 hover:bg-suka-gray-50'}`}>1 Bulan Terakhir</Link>
          <CustomDateFilter />
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Pendapatan</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{formatRupiah(omzetToday)}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-2 ${
            isPositive ? 'text-suka-green bg-suka-green/10' : 'text-red-500 bg-red-50'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : '-'}{absChange}% dari periode sebelumnya
          </span>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Jumlah Transaksi</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{txToday}</p>
          <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-2 py-0.5 rounded-full inline-block mt-2">Selesai pada periode ini</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <ListChecks size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Jumlah Item Terjual</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{itemsSoldToday}</p>
          <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-2 py-0.5 rounded-full inline-block mt-2">Total Produk pada periode ini</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 lg:col-span-2 min-h-[300px]">
          <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider mb-6 border-b border-suka-brown/5 pb-3">Ranking Outlet (Berdasarkan Omzet)</h3>
          <RankingList outletRanking={outletRanking} maxOmzet={maxOmzet} />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 min-h-[300px] lg:col-span-1">
          <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider mb-4 border-b border-suka-brown/5 pb-3">Status Outlet</h3>
          {allOutlets.length === 0 ? (
            <p className="text-sm text-suka-gray-400">Tidak ada outlet.</p>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedOutlets.entries()).map(([groupKey, groupOutlets]) => (
                <div key={groupKey}>
                  <h4 className="text-xs font-black text-suka-orange mb-3 bg-suka-orange/10 px-3 py-1.5 rounded-lg inline-block">{groupKey}</h4>
                  <ul className="space-y-4">
                    {groupOutlets.map(outlet => (
                      <li key={outlet.id} className="flex justify-between items-center">
                        <span className="text-sm font-bold text-suka-brown">{outlet.name}</span>
                        {outletFirstCheckIn.has(outlet.id) ? (
                          <span className="px-2.5 py-1 bg-suka-green/10 text-suka-green text-[10px] rounded-full font-black uppercase tracking-widest shadow-sm">Buka - {outletFirstCheckIn.get(outlet.id)}</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[10px] rounded-full font-black uppercase tracking-widest shadow-sm">Tutup</span>
                        )}
                      </li>
                    ))}
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
