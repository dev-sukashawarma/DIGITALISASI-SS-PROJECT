import { createClient } from '@/lib/supabase/server';
import ProfitClient from './ProfitClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PawoonProfitPage({
    searchParams,
}: {
    searchParams: Promise<{ outlet?: string; from?: string; to?: string }>;
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

    // If no outlet is selected and no date is selected, skip heavy fetching
    const shouldFetchData = selectedOutletId !== '';

    // Fetch all synced orders metadata
    const allSyncedOrders: any[] = [];
    let fromIndex = 0;
    const step = 1000;
    
    if (shouldFetchData) {
        let query = supabase
            .from('orders')
            .select('id, outlet_id, created_at, source')
            .not('external_order_id', 'is', null)
            .eq('source', 'pos');

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
        const chunkSize = 500;
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
                        menu_items ( hpp_override )
                    `)
                    .in('order_id', chunk)
            );
            
            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res.data) allOrderItems.push(...res.data);
            });
        }
    }

    // Process data to calculate profit
    // Map order ID to outlet type to apply +10% rule
    const orderOutletMap = new Map<string, any>();
    const outletTypeMap = new Map<string, string>();
    
    outlets?.forEach(o => outletTypeMap.set(o.id, o.type));
    
    allSyncedOrders.forEach(o => {
        orderOutletMap.set(o.id, outletTypeMap.get(o.outlet_id) || 'outlet');
    });

    let totalOmset = 0;
    let totalHpp = 0;
    const itemSummary: Record<string, any> = {};

    allOrderItems.forEach(item => {
        totalOmset += item.subtotal;
        
        const outletType = orderOutletMap.get(item.order_id) || 'outlet';
        
        let baseHpp = item.menu_items?.hpp_override || 0;
        
        // HPP Mitra Rule: HPP Pusat + 10%
        if (outletType === 'mitra' && baseHpp > 0) {
            baseHpp = Math.round(baseHpp * 1.10);
        }
        
        const itemTotalHpp = baseHpp * item.quantity;
        totalHpp += itemTotalHpp;

        if (!itemSummary[item.menu_item_id]) {
            itemSummary[item.menu_item_id] = {
                id: item.menu_item_id,
                name: item.menu_item_name,
                qty: 0,
                omset: 0,
                hppTotal: 0,
                hppUnit: baseHpp, // we just store the last one seen, if it crosses outlet types it might be weird, but usually filtered by outlet
                missingHpp: item.menu_items?.hpp_override === null,
                outletType: outletType
            };
        }
        
        itemSummary[item.menu_item_id].qty += item.quantity;
        itemSummary[item.menu_item_id].omset += item.subtotal;
        itemSummary[item.menu_item_id].hppTotal += itemTotalHpp;
        // if this item has missing HPP, flag it
        if (item.menu_items?.hpp_override === null) {
             itemSummary[item.menu_item_id].missingHpp = true;
        }
    });

    const summaryList = Object.values(itemSummary)
        .sort((a, b) => b.omset - a.omset); // Sort by omset descending

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
                totalOmset={totalOmset}
                totalHpp={totalHpp}
                grossProfit={grossProfit}
                marginPct={marginPct}
                itemSummary={summaryList}
                totalOrders={allSyncedOrders.length}
            />
        </div>
    );
}
