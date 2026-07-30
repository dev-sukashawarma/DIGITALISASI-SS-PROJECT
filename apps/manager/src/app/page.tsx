import React from 'react';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ListChecks } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';

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

export default async function DashboardOverview() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  });

  const now = new Date();
  const today = getJakartaDateString(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getJakartaDateString(yesterdayDate);

  let qToday = supabase.from('sales_hourly_spv').select('omzet, jumlah_order_completed').eq('sales_date', today);
  let qYesterday = supabase.from('sales_hourly_spv').select('omzet').eq('sales_date', yesterday);
  let qOutlets = supabase.from('outlets').select('id, name, is_active');
  let qPettyCash = supabase.from('petty_cash_topups')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'forwarded_to_area_manager', 'forwarded_by_leader']);

  // If staff is bound to a specific outlet, filter data
  if (staff?.outlet_id) {
    qToday = qToday.eq('outlet_id', staff.outlet_id);
    qYesterday = qYesterday.eq('outlet_id', staff.outlet_id);
    qOutlets = qOutlets.eq('id', staff.outlet_id);
    qPettyCash = qPettyCash.eq('outlet_id', staff.outlet_id);
  }

  const [
    { data: salesToday },
    { data: salesYesterday },
    { data: outlets },
    { count: pettyCashPending }
  ] = await Promise.all([
    qToday,
    qYesterday,
    qOutlets,
    qPettyCash
  ]);

  const omzetToday = (salesToday || []).reduce((sum, r) => sum + Number(r.omzet), 0);
  const txToday = (salesToday || []).reduce((sum, r) => sum + Number(r.jumlah_order_completed), 0);
  const omzetYesterday = (salesYesterday || []).reduce((sum, r) => sum + Number(r.omzet), 0);

  let percentageChange = 0;
  if (omzetYesterday === 0) {
    percentageChange = omzetToday > 0 ? 100 : 0;
  } else {
    percentageChange = ((omzetToday - omzetYesterday) / omzetYesterday) * 100;
  }

  const isPositive = percentageChange >= 0;
  const absChange = Math.abs(percentageChange).toFixed(1);

  const activeOutlets = (outlets || []).filter(o => o.is_active);
  const allOutlets = outlets || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Ringkasan Area</h2>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Pendapatan (Hari Ini)</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{formatRupiah(omzetToday)}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-2 ${
            isPositive ? 'text-suka-green bg-suka-green/10' : 'text-red-500 bg-red-50'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : '-'}{absChange}% dari kemarin
          </span>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <ListChecks size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Outlet Buka</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{activeOutlets.length} <span className="text-lg text-suka-gray-300 font-medium">/ {allOutlets.length}</span></p>
          <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-2 py-0.5 rounded-full inline-block mt-2">
            {activeOutlets.length === allOutlets.length ? 'Semua outlet beroperasi' : `${allOutlets.length - activeOutlets.length} outlet tutup`}
          </span>
        </div>
        
        <div className="bg-suka-orange/10 p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-orange/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-suka-orange/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="absolute top-4 right-4 text-suka-orange">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xs font-bold text-suka-orange uppercase tracking-wider mb-2">Petty Cash Pending</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-orange">{pettyCashPending || 0}</p>
          <span className="text-[10px] font-bold text-white bg-suka-orange px-2 py-0.5 rounded-full inline-block mt-2 shadow-sm">Butuh approval Anda</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={48} className="text-suka-orange" />
          </div>
          <h3 className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Total Transaksi</h3>
          <p className="text-2xl sm:text-3xl font-black text-suka-brown">{txToday}</p>
          <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-2 py-0.5 rounded-full inline-block mt-2">Hari ini</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 lg:col-span-2 min-h-[300px] flex items-center justify-center">
          <p className="text-suka-gray-300 font-bold">Grafik Penjualan Area (Tahap Pengembangan)</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 min-h-[300px]">
          <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider mb-4 border-b border-suka-brown/5 pb-3">Status Outlet</h3>
          {allOutlets.length === 0 ? (
            <p className="text-sm text-suka-gray-400">Tidak ada outlet.</p>
          ) : (
            <ul className="space-y-4">
              {allOutlets.map(outlet => (
                <li key={outlet.id} className="flex justify-between items-center">
                  <span className="text-sm font-bold text-suka-brown">{outlet.name}</span>
                  {outlet.is_active ? (
                    <span className="px-2.5 py-1 bg-suka-green/10 text-suka-green text-[10px] rounded-full font-black uppercase tracking-widest shadow-sm">Buka</span>
                  ) : (
                    <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[10px] rounded-full font-black uppercase tracking-widest shadow-sm">Tutup</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
