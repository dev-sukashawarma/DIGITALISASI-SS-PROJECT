import { createClient } from '@/lib/supabase/server';
import ProfitClient from './ProfitClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PawoonProfitPage({
    searchParams,
}: {
    searchParams: Promise<{ outlet?: string; from?: string; to?: string; channel?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;

    // Fetch outlets for filter dropdown
    const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name, type, is_active')
        .order('name');

    const selectedOutletId = params.outlet || '';
    const fromDate = params.from || '';
    const toDate = params.to || '';
    // 'ALL' | 'offline' | 'food_apps' | 'tiktok_go'
    const selectedChannel = params.channel || 'ALL';

    // If no outlet is selected and no date is selected, skip heavy fetching
    const shouldFetchData = selectedOutletId !== '';

    // Fetch all synced orders metadata
    const allSyncedOrders: any[] = [];
    let fromIndex = 0;
    const step = 1000;
    
    if (shouldFetchData) {
        // NET methodology (match Excel Grand Total Pawoon): fetch completed DAN cancelled,
        // lalu qty/omset order cancelled dikurangkan (bukan di-exclude total) saat agregasi di bawah.
        // Lihat docs/superpowers/specs/2026-07-29-pawoon-data-discrepancy-analysis.md section 7.
        let query = supabase
            .from('orders')
            .select('id, outlet_id, created_at, source, status, total_amount')
            .not('external_order_id', 'is', null)
            .eq('source', 'pos')
            .in('status', ['completed', 'cancelled']);

        if (selectedOutletId !== 'ALL') {
            query = query.eq('outlet_id', selectedOutletId);
        }
        
        if (fromDate) {
            query = query.gte('created_at', fromDate);
        }
        if (toDate) {
            const toDateEnd = new Date(toDate);
            toDateEnd.setHours(23, 59, 59, 999);
            query = query.lte('created_at', toDateEnd.toISOString());
        }

        // Chunking to get all orders
        while (true) {
            const { data } = await query.range(fromIndex, fromIndex + step - 1);
                
            if (data && data.length > 0) {
                allSyncedOrders.push(...data);
            }
            
            if (!data || data.length < step) {
                break;
            }
            fromIndex += step;
        }
    }

    const orderIds = allSyncedOrders.map(o => o.id);

    // Fetch all order items for these orders and join menu_items
    const allOrderItems: any[] = [];
    if (orderIds.length > 0) {
        // Parallel fetching because array could be large
        // Use a smaller chunk size (100) to avoid 414 URI Too Long errors in PostgREST GET requests
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0; i < orderIds.length; i += chunkSize) {
            chunks.push(orderIds.slice(i, i + chunkSize));
        }
        
        // Batch promises to avoid overloading connection pool
        for (let i = 0; i < chunks.length; i += 10) {
            const batch = chunks.slice(i, i + 10);
            const promises = batch.map(chunk => 
                supabase
                    .from('order_items')
                    .select(`
                        order_id, 
                        menu_item_id, 
                        menu_item_name, 
                        quantity, 
                        unit_price, 
                        subtotal,
                        channel,
                        menu_items ( 
                            hpp_override,
                            is_package,
                            package_items:menu_packages!package_id (
                                quantity,
                                component:menu_items!menu_item_id ( hpp_override )
                            )
                        )
                    `)
                    .in('order_id', chunk)
            );
            
            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res.error) console.error('Error fetching order items chunk:', res.error);
                if (res.data) allOrderItems.push(...res.data);
            });
        }
    }

    // Process data to calculate profit
    // Map order ID to outlet type (+10% rule) dan status (buat sign NET) sekaligus
    const orderOutletMap = new Map<string, any>();
    const orderStatusMap = new Map<string, string>();
    const outletTypeMap = new Map<string, string>();

    outlets?.forEach(o => outletTypeMap.set(o.id, o.type));

    allSyncedOrders.forEach(o => {
        orderOutletMap.set(o.id, outletTypeMap.get(o.outlet_id) || 'outlet');
        orderStatusMap.set(o.id, o.status);
    });

    // Total Pendapatan (Omset) headline: pakai orders.total_amount (angka Total asli Pawoon,
    // termasuk diskon/service charge/pembulatan transaksi), BUKAN jumlah order_items.subtotal
    // (cuma harga x qty per baris, tidak termasuk penyesuaian level-transaksi). Ini supaya match
    // persis Grand Total di halaman Migrasi Pawoon. Lihat section 7 di
    // docs/superpowers/specs/2026-07-29-pawoon-data-discrepancy-analysis.md.
    // Breakdown per-item di bawah tetap pakai item.subtotal (satu-satunya proxy omset per menu
    // yang ada) — makanya totalOmset (headline) bisa sedikit beda dari SUM(itemSummary.omset).
    // CATATAN filter channel: orders.total_amount adalah angka per-STRUK (bisa campur beberapa
    // channel dalam 1 struk), jadi tidak bisa dipotong per channel. Saat filter channel aktif,
    // totalOmset otomatis jatuh balik ke SUM(item.subtotal) yang sudah difilter channel di bawah.
    const totalOmsetFromOrders = allSyncedOrders.reduce((sum, o) => {
        const sign = o.status === 'cancelled' ? -1 : 1;
        return sum + (o.total_amount || 0) * sign;
    }, 0);

    let totalOmsetFromItems = 0;
    let totalHpp = 0;
    const itemSummary: Record<string, any> = {};
    const qualifyingOrderIds = new Set<string>();

    allOrderItems.forEach(item => {
        // Use item.channel as the source of truth (set during Pawoon import from product name prefix)
        // Falls back to 'offline' for POS kasir data (default value)
        const rawItemChannel = item.channel || 'offline';
        if (selectedChannel !== 'ALL' && rawItemChannel !== selectedChannel) return;
        qualifyingOrderIds.add(item.order_id);

        // NET: order cancelled (void) mengurangi qty/hpp, bukan di-exclude.
        const sign = orderStatusMap.get(item.order_id) === 'cancelled' ? -1 : 1;
        const signedQty = item.quantity * sign;
        const signedSubtotal = item.subtotal * sign;
        totalOmsetFromItems += signedSubtotal;

        const outletType = orderOutletMap.get(item.order_id) || 'outlet';

        let baseHpp = 0;
        let isMissing = false;

        if (item.menu_items?.is_package) {
            if (item.menu_items?.hpp_override !== null) {
                baseHpp = item.menu_items.hpp_override;
            } else {
                let pkgHpp = 0;
                let pkgMissing = false;
                item.menu_items.package_items?.forEach((pkg: any) => {
                    if (pkg.component?.hpp_override === null) pkgMissing = true;
                    pkgHpp += (pkg.component?.hpp_override || 0) * (pkg.quantity || 1);
                });
                baseHpp = pkgHpp;
                isMissing = pkgMissing || (item.menu_items.package_items?.length === 0);
            }
        } else {
            baseHpp = item.menu_items?.hpp_override || 0;
            isMissing = item.menu_items?.hpp_override === null;
        }

        // HPP Mitra Rule: HPP Pusat + 10%
        if (outletType === 'mitra' && baseHpp > 0) {
            baseHpp = Math.round(baseHpp * 1.10);
        }

        const itemTotalHpp = baseHpp * signedQty;
        totalHpp += itemTotalHpp;

        let channelGroup = 'OFFLINE';
        if (rawItemChannel === 'food_apps') channelGroup = 'FOOD APPS';
        else if (rawItemChannel === 'tiktok_go') channelGroup = 'TIKTOK GO';

        const summaryKey = item.menu_item_id;

        if (!itemSummary[summaryKey]) {
            itemSummary[summaryKey] = {
                id: item.menu_item_id,
                name: item.menu_item_name,
                qty: 0,
                omset: 0,
                hppTotal: 0,
                hppUnit: baseHpp, // we just store the last one seen, if it crosses outlet types it might be weird, but usually filtered by outlet
                missingHpp: isMissing,
                outletType: outletType,
                channels: {}
            };
        }

        itemSummary[summaryKey].qty += signedQty;
        itemSummary[summaryKey].omset += signedSubtotal;
        itemSummary[summaryKey].hppTotal += itemTotalHpp;
        // if this item has missing HPP, flag it
        if (isMissing) {
             itemSummary[summaryKey].missingHpp = true;
        }

        if (!itemSummary[summaryKey].channels[channelGroup]) {
            itemSummary[summaryKey].channels[channelGroup] = { qty: 0, omset: 0, hppTotal: 0 };
        }
        itemSummary[summaryKey].channels[channelGroup].qty += signedQty;
        itemSummary[summaryKey].channels[channelGroup].omset += signedSubtotal;
        itemSummary[summaryKey].channels[channelGroup].hppTotal += itemTotalHpp;
    });

    const summaryList = Object.values(itemSummary)
        .sort((a, b) => b.omset - a.omset); // Sort by omset descending

    // Filter channel aktif -> orders.total_amount tak bisa dipotong per channel (1 struk bisa
    // campur channel), jatuh balik ke SUM(item.subtotal) yang sudah difilter. Filter channel = ALL
    // -> tetap pakai orders.total_amount (match persis Grand Total Excel, lihat catatan di atas).
    const totalOmset = selectedChannel === 'ALL' ? totalOmsetFromOrders : totalOmsetFromItems;
    const totalOrders = selectedChannel === 'ALL' ? allSyncedOrders.length : qualifyingOrderIds.size;

    const grossProfit = totalOmset - totalHpp;
    const marginPct = totalOmset > 0 ? (grossProfit / totalOmset) * 100 : 0;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/pawoon-import/synced" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Laba Kotor (Pawoon)</h1>
                    <p className="text-gray-500 mt-1">
                        Analisis gross profit dari data historis Pawoon. 
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full ml-2">HPP Mitra = HPP Pusat + 10%</span>
                    </p>
                </div>
            </div>

            <ProfitClient
                outlets={outlets || []}
                selectedOutletId={selectedOutletId}
                fromDate={fromDate}
                toDate={toDate}
                selectedChannel={selectedChannel}
                totalOmset={totalOmset}
                totalHpp={totalHpp}
                grossProfit={grossProfit}
                marginPct={marginPct}
                itemSummary={summaryList}
                totalOrders={totalOrders}
            />
        </div>
    );
}
