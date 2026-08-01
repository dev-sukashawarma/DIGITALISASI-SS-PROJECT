
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import SyncedFilters from './SyncedFilters';

export const dynamic = 'force-dynamic';

export default async function SyncedPawoonDataPage({
    searchParams,
}: {
    searchParams: Promise<{ outlet?: string; from?: string; to?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;

    // Fetch outlets for filter dropdown and summary
    const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name, type, is_active')
        .order('name');

    const selectedOutletId = params.outlet || 'ALL';
    const fromDate = params.from || '';
    const toDate = params.to || '';

    // Fetch all synced orders metadata to build a summary of which outlets have data
    // Supabase limits each query to 1000 rows, so we must paginate to get all records
    const allSyncedOrders: any[] = [];
    let fromIndex = 0;
    const step = 1000;
    
    while (true) {
        const { data } = await supabase
            .from('orders')
            .select('outlet_id, created_at')
            .not('external_order_id', 'is', null)
            .eq('source', 'pos')
            .range(fromIndex, fromIndex + step - 1);
            
        if (data && data.length > 0) {
            allSyncedOrders.push(...data);
        }
        
        if (!data || data.length < step) {
            break;
        }
        fromIndex += step;
    }

    const syncedSummary: Record<string, { min: number; max: number; count: number }> = {};
    (allSyncedOrders || []).forEach(o => {
        const d = new Date(o.created_at).getTime();
        if (!syncedSummary[o.outlet_id]) {
            syncedSummary[o.outlet_id] = { min: d, max: d, count: 1 };
        } else {
            if (d < syncedSummary[o.outlet_id].min) syncedSummary[o.outlet_id].min = d;
            if (d > syncedSummary[o.outlet_id].max) syncedSummary[o.outlet_id].max = d;
            syncedSummary[o.outlet_id].count++;
        }
    });

    let orders: any[] = [];
    let error: any = null;

    // Only fetch table data if an outlet is explicitly selected
    if (selectedOutletId !== 'ALL') {
        let fromIndexTable = 0;
        const stepTable = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('orders')
                .select('id, external_order_id, total_amount, created_at, status, sales_source, payment_method, outlet_id')
                .eq('source', 'pos')
                .not('external_order_id', 'is', null)
                .eq('outlet_id', selectedOutletId);

            if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`);
            if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`);

            const res = await query
                .order('created_at', { ascending: false })
                .range(fromIndexTable, fromIndexTable + stepTable - 1);

            if (res.error) {
                error = res.error;
                hasMore = false;
            } else if (res.data && res.data.length > 0) {
                orders.push(...res.data);
                if (res.data.length < stepTable) {
                    hasMore = false;
                } else {
                    fromIndexTable += stepTable;
                }
            } else {
                hasMore = false;
            }
        }
    }

    // Group by date
    type DailySummary = {
        date: string;
        struk: number;
        omsetKotor: number;
        voidJml: number;
        voidNilai: number;
        grandTotal: number;
        offline: number;
        grabfood: number;
        tiktok: number;
        cash: number;
        qris: number;
        card: number;
    };

    const byDate: Record<string, DailySummary> = {};

    (orders || []).forEach((order: any) => {
        const dateKey = new Date(order.created_at).toLocaleDateString('id-ID', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta'
        });

        if (!byDate[dateKey]) {
            byDate[dateKey] = {
                date: dateKey,
                struk: 0,
                omsetKotor: 0,
                voidJml: 0,
                voidNilai: 0,
                grandTotal: 0,
                offline: 0,
                grabfood: 0,
                tiktok: 0,
                cash: 0,
                qris: 0,
                card: 0,
            };
        }

        const d = byDate[dateKey];
        const amount = Number(order.total_amount) || 0;

        if (order.status === 'completed') {
            d.struk++;
            d.omsetKotor += amount;
            d.grandTotal += amount;

            // Channel breakdown (only completed)
            if (order.sales_source === 'pos') d.offline += amount;
            else if (order.sales_source === 'grabfood') d.grabfood += amount;
            else if (order.sales_source === 'tiktok') d.tiktok += amount;

            // Payment breakdown
            if (order.payment_method === 'cash') d.cash += amount;
            else if (order.payment_method === 'qris') d.qris += amount;
            else if (order.payment_method === 'card') d.card += amount;
        } else if (order.status === 'cancelled') {
            d.voidJml++;
            d.voidNilai += amount;
            d.grandTotal -= amount;
        }
    });

    const rows = Object.values(byDate).sort((a, b) => {
        // Sort descending by date string (dd/mm/yyyy → parse)
        const parseDate = (s: string) => {
            const [dd, mm, yyyy] = s.split('/');
            return new Date(`${yyyy}-${mm}-${dd}`).getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });

    // Totals row
    const totals = rows.reduce(
        (acc, r) => ({
            struk: acc.struk + r.struk,
            omsetKotor: acc.omsetKotor + r.omsetKotor,
            voidJml: acc.voidJml + r.voidJml,
            voidNilai: acc.voidNilai + r.voidNilai,
            grandTotal: acc.grandTotal + r.grandTotal,
            offline: acc.offline + r.offline,
            grabfood: acc.grabfood + r.grabfood,
            tiktok: acc.tiktok + r.tiktok,
            cash: acc.cash + r.cash,
            qris: acc.qris + r.qris,
            card: acc.card + r.card,
        }),
        { struk: 0, omsetKotor: 0, voidJml: 0, voidNilai: 0, grandTotal: 0, offline: 0, grabfood: 0, tiktok: 0, cash: 0, qris: 0, card: 0 }
    );

    const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    // Date range info
    const allDates = rows.map(r => r.date);
    const earliestDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;
    const latestDate = allDates.length > 0 ? allDates[0] : null;

    return (
        <div className="p-6 max-w-screen-xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Data Pawoon Tersinkron</h1>
                    <p className="text-gray-500 mt-1">Rekap harian transaksi yang sudah berhasil di-sync dari Excel Pawoon ke sistem.</p>
                    {earliestDate && latestDate && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                Tersinkron: {earliestDate} – {latestDate}
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                                {rows.length} hari • {totals.struk} struk
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/dashboard/pawoon-import/profit"
                        className="bg-suka-primary hover:bg-suka-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm"
                    >
                        Laporan Profit
                    </Link>
                    <Link
                        href="/dashboard/pawoon-import"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                        Kembali ke Import
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <SyncedFilters outlets={outlets || []} selectedOutletId={selectedOutletId} fromDate={fromDate} toDate={toDate} />

            {/* Table or Placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                {selectedOutletId === 'ALL' ? (
                    <div className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-500 mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Pilih Outlet Terlebih Dahulu</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-6">
                            Untuk melihat detail rekapan transaksi harian, silakan pilih spesifik outlet dari filter di atas.
                        </p>
                        
                        {(() => {
                            const cabangOutlets = (outlets || []).filter(o => o.type === 'outlet');
                            const mitraOutlets = (outlets || []).filter(o => o.type === 'mitra');

                            return (
                                <div className="space-y-6">
                                    {cabangOutlets.length > 0 && (
                                        <div className="max-w-xl mx-auto bg-gray-50 rounded-xl p-6 text-left border border-gray-100 shadow-inner">
                                            <h4 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2 border-b border-gray-200 pb-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                Status Sinkronisasi Outlet Cabang:
                                            </h4>
                                            <ul className="space-y-3">
                                                {cabangOutlets.map((outlet) => {
                                                    const sum = syncedSummary[outlet.id];
                                                    return (
                                                        <li key={outlet.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${sum ? 'text-gray-700' : 'text-gray-400'}`}>{outlet.name}</span>
                                                                {!outlet.is_active && <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tutup</span>}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {sum ? (
                                                                    <>
                                                                        <span className="text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100 text-xs">
                                                                            {new Date(sum.min).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })} – {new Date(sum.max).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                                                                        </span>
                                                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{sum.count} items</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 text-xs font-semibold">Belum tersinkronisasi</span>
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}

                                    {mitraOutlets.length > 0 && (
                                        <div className="max-w-xl mx-auto bg-amber-50 rounded-xl p-6 text-left border border-amber-100 shadow-inner">
                                            <h4 className="font-semibold text-amber-900 mb-4 text-sm flex items-center gap-2 border-b border-amber-200 pb-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                Status Sinkronisasi Outlet Mitra:
                                            </h4>
                                            <ul className="space-y-3">
                                                {mitraOutlets.map((outlet) => {
                                                    const sum = syncedSummary[outlet.id];
                                                    // Outlet yang sudah diverifikasi lengkap datanya
                                                    const VERIFIED_OUTLETS = ['MITRA CICURUG', 'MITRA CIBINONG', 'MITRA CISEENG', 'MITRA SENTUL', 'MITRA PEKAYON', 'PEKAYON', 'MITRA KALISARI', 'KALISARI'];
                                                    const isVerified = VERIFIED_OUTLETS.includes(outlet.name.toUpperCase());
                                                    
                                                    return (
                                                        <li key={outlet.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${sum ? 'text-amber-900' : 'text-amber-600 opacity-60'} flex items-center gap-1.5`}>
                                                                    {outlet.name}
                                                                    {isVerified && (
                                                                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                </span>
                                                                {!outlet.is_active && <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tutup</span>}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {sum ? (
                                                                    <>
                                                                        <span className="text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-100 text-xs">
                                                                            {new Date(sum.min).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })} – {new Date(sum.max).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })}
                                                                        </span>
                                                                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">{sum.count} items</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 text-xs font-semibold">Belum tersinkronisasi</span>
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                ) : error ? (
                    <div className="p-6 text-red-600 font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Gagal memuat data: {error.message}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 border-b text-xs uppercase tracking-wide">
                                    <th className="p-3 font-semibold">Tanggal</th>
                                    <th className="p-3 font-semibold text-center">Struk</th>
                                    <th className="p-3 font-semibold text-right">Omset Kotor</th>
                                    <th className="p-3 font-semibold text-center">Void (Jml)</th>
                                    <th className="p-3 font-semibold text-right">Void (Nilai)</th>
                                    <th className="p-3 font-semibold text-right bg-blue-50 text-blue-700">Grand Total</th>
                                    <th className="p-3 font-semibold text-right border-l border-gray-200">Offline</th>
                                    <th className="p-3 font-semibold text-right">GrabFood</th>
                                    <th className="p-3 font-semibold text-right">TikTok</th>
                                    <th className="p-3 font-semibold text-right border-l border-gray-200">Cash</th>
                                    <th className="p-3 font-semibold text-right">QRIS</th>
                                    <th className="p-3 font-semibold text-right">Card</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="p-8 text-center text-gray-400">
                                            Belum ada data yang tersinkron untuk filter ini.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <tr key={r.date} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-3 font-medium text-gray-800 whitespace-nowrap">{r.date}</td>
                                            <td className="p-3 text-center text-gray-700">{r.struk}</td>
                                            <td className="p-3 text-right text-gray-700">{fmt(r.omsetKotor)}</td>
                                            <td className="p-3 text-center">
                                                {r.voidJml > 0 ? (
                                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">{r.voidJml}</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right text-orange-600 font-medium">
                                                {r.voidNilai > 0 ? fmt(r.voidNilai) : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="p-3 text-right font-bold text-blue-800 bg-blue-50">{fmt(r.grandTotal)}</td>
                                            <td className="p-3 text-right text-gray-600 border-l border-gray-100">{r.offline > 0 ? fmt(r.offline) : <span className="text-gray-300">-</span>}</td>
                                            <td className="p-3 text-right text-gray-600">{r.grabfood > 0 ? fmt(r.grabfood) : <span className="text-gray-300">-</span>}</td>
                                            <td className="p-3 text-right text-gray-600">{r.tiktok > 0 ? fmt(r.tiktok) : <span className="text-gray-300">-</span>}</td>
                                            <td className="p-3 text-right text-gray-600 border-l border-gray-100">{r.cash > 0 ? fmt(r.cash) : <span className="text-gray-300">-</span>}</td>
                                            <td className="p-3 text-right text-gray-600">{r.qris > 0 ? fmt(r.qris) : <span className="text-gray-300">-</span>}</td>
                                            <td className="p-3 text-right text-gray-600">{r.card > 0 ? fmt(r.card) : <span className="text-gray-300">-</span>}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {rows.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-900 text-white font-bold text-sm">
                                        <td className="p-3">TOTAL</td>
                                        <td className="p-3 text-center">{totals.struk}</td>
                                        <td className="p-3 text-right">{fmt(totals.omsetKotor)}</td>
                                        <td className="p-3 text-center">{totals.voidJml > 0 ? totals.voidJml : '-'}</td>
                                        <td className="p-3 text-right">{totals.voidNilai > 0 ? fmt(totals.voidNilai) : '-'}</td>
                                        <td className="p-3 text-right text-blue-300">{fmt(totals.grandTotal)}</td>
                                        <td className="p-3 text-right border-l border-gray-700">{totals.offline > 0 ? fmt(totals.offline) : '-'}</td>
                                        <td className="p-3 text-right">{totals.grabfood > 0 ? fmt(totals.grabfood) : '-'}</td>
                                        <td className="p-3 text-right">{totals.tiktok > 0 ? fmt(totals.tiktok) : '-'}</td>
                                        <td className="p-3 text-right border-l border-gray-700">{totals.cash > 0 ? fmt(totals.cash) : '-'}</td>
                                        <td className="p-3 text-right">{totals.qris > 0 ? fmt(totals.qris) : '-'}</td>
                                        <td className="p-3 text-right">{totals.card > 0 ? fmt(totals.card) : '-'}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
