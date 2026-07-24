'use server';

import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Setup Supabase (Server side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function previewPawoonFile(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        // Load mapping
        const mapPath = path.join(process.cwd(), 'src', 'data', 'pawoon_item_map.json');
        let itemMap = { mapping: {} as Record<string, { system_id: string, name: string }> };
        if (fs.existsSync(mapPath)) {
            itemMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } else {
            return { success: false, error: "Mapping file not found" };
        }

        // Load outlets
        const { data: outletsData, error: outletsError } = await supabase.from('outlets').select('id, name');
        if (outletsError) {
            return { success: false, error: "Failed to fetch outlets" };
        }
        
        const outletIdMap: Record<string, string> = {};
        outletsData.forEach(o => {
            const normalName = o.name.toLowerCase().replace('suka shawarma ', '').trim();
            outletIdMap[normalName] = o.id;
            outletIdMap[o.name.toLowerCase()] = o.id;
        });

        let headerRowIdx = -1;
        for (let i = 0; i < 20; i++) {
            const rowStr = (data[i] || []).join(' ').toLowerCase();
            if (rowStr.includes('id struk') || rowStr.includes('nama produk')) {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            return { success: false, error: "Format Excel tidak dikenali (Header ID Struk tidak ditemukan)" };
        }

        const headers = (data[headerRowIdx] as string[]).map(h => typeof h === 'string' ? h.toLowerCase() : '');
        const colIdx = {
            date: headers.findIndex(h => h.includes('waktu')),
            receipt: headers.findIndex(h => h.includes('id struk')),
            outlet: headers.findIndex(h => h === 'outlet'),
            product: headers.findIndex(h => h.includes('nama produk')),
            qty: headers.findIndex(h => h.includes('jumlah produk')),
            price: headers.findIndex(h => h.includes('harga produk')),
            cat: headers.findIndex(h => h === 'kategori'),
            status: headers.findIndex(h => h.includes('status pembayaran')),
            total: headers.findIndex(h => h === 'total'),
            payment: headers.findIndex(h => h === 'metode pembayaran')
        };

        const ordersMap = new Map<string, any>();
        let unmappedItems = new Set<string>();
        let unmappedOutlets = new Set<string>();
        
        // Items Sales Tracker
        const itemSalesTracker: Record<string, { systemName: string, offline: number, food_apps: number, tiktok: number }> = {};

        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[colIdx.receipt]) continue;
            
            const receipt = row[colIdx.receipt].toString().trim();
            const status = row[colIdx.status] ? row[colIdx.status].toString() : '';
            if (status.toLowerCase() !== 'success') continue; 
            
            let productName = row[colIdx.product] ? row[colIdx.product].toString().trim() : '';
            if (!productName || productName.startsWith('+')) continue; 

            const rawOutlet = row[colIdx.outlet] ? row[colIdx.outlet].toString().trim() : '';
            const normalOutlet = rawOutlet.toLowerCase().replace('suka shawarma ', '').trim();
            const outletId = outletIdMap[normalOutlet] || outletIdMap[rawOutlet.toLowerCase()];
            
            if (!outletId) {
                unmappedOutlets.add(rawOutlet);
                continue;
            }

            const mapConfig = itemMap.mapping[productName];
            if (!mapConfig) {
                unmappedItems.add(productName);
                continue;
            }

            const qty = parseInt(row[colIdx.qty]) || 1;
            const price = parseFloat(row[colIdx.price]) || 0;
            const category = row[colIdx.cat] ? row[colIdx.cat].toString() : '';
            const orderTotal = parseFloat(row[colIdx.total]) || (price * qty); 
            const dateStr = row[colIdx.date] ? row[colIdx.date].toString() : '';
            
            let isoDate = new Date().toISOString();
            if (dateStr) {
                const parts = dateStr.split(' ');
                if (parts.length === 2) {
                    const dparts = parts[0].split('-');
                    if (dparts.length === 3) {
                        isoDate = `${dparts[2]}-${dparts[1]}-${dparts[0]}T${parts[1]}+07:00`;
                    }
                }
            }

            let channel = 'pos';
            if (productName.includes('FOOD APPS') || category === 'FOOD APPS') channel = 'food_apps';
            else if (productName.includes('BEST SELLER - ') || category === 'SS TIKTOK GO') channel = 'tiktok';

            let orderStatus = 'completed';
            const statusLower = status.toLowerCase();
            if (statusLower === 'void' || statusLower === 'refund') {
                orderStatus = 'cancelled';
            }

            if (!ordersMap.has(receipt)) {
                ordersMap.set(receipt, {
                    id: uuidv4(),
                    external_order_id: receipt,
                    outlet_id: outletId,
                    source: 'PAWOON',
                    channel: channel,
                    sales_source: channel === 'pos' ? 'walk_in' : channel,
                    order_status: orderStatus,
                    payment_status: statusLower === 'void' ? 'refunded' : 'paid',
                    payment_method: row[colIdx.payment] ? row[colIdx.payment].toString() : 'Cash',
                    total_amount: orderTotal, 
                    gross_amount: price * qty,
                    customer_name: 'Pawoon Import',
                    created_at: isoDate,
                    items: []
                });
            } else {
                const existingOrder = ordersMap.get(receipt);
                existingOrder.gross_amount += (price * qty);
            }
            
            const order = ordersMap.get(receipt);
            if (channel !== 'pos') {
                order.channel = channel;
                order.sales_source = channel;
            }

            order.items.push({
                id: uuidv4(),
                order_id: order.id,
                menu_item_id: mapConfig.system_id,
                quantity: qty,
                unit_price: price,
                subtotal: qty * price,
                _systemName: mapConfig.name || mapConfig.system_name || productName
            });
            
            // Tracker logic
            const systemName = mapConfig.name || mapConfig.system_name || productName;
            if (!itemSalesTracker[systemName]) {
                itemSalesTracker[systemName] = { systemName, offline: 0, food_apps: 0, tiktok: 0 };
            }
            if (channel === 'pos') itemSalesTracker[systemName].offline += qty;
            else if (channel === 'food_apps') itemSalesTracker[systemName].food_apps += qty;
            else if (channel === 'tiktok') itemSalesTracker[systemName].tiktok += qty;
        }

        if (unmappedItems.size > 0 || unmappedOutlets.size > 0) {
            return {
                success: false,
                error: "Ditemukan Item/Outlet yang belum di-map",
                unmappedItems: Array.from(unmappedItems),
                unmappedOutlets: Array.from(unmappedOutlets)
            };
        }
        
        // Find existing orders to skip
        let existingReceipts = new Set<string>();
        const batchSize = 100;
        const receiptsArr = Array.from(ordersMap.keys());
        
        for (let i = 0; i < receiptsArr.length; i += batchSize) {
            const batch = receiptsArr.slice(i, i + batchSize);
            const { data: existing } = await supabase.from('orders')
                .select('external_order_id')
                .in('external_order_id', batch);
            if (existing) {
                existing.forEach(o => existingReceipts.add(o.external_order_id));
            }
        }

        const ordersToInsert: any[] = [];
        const itemsToInsert: any[] = [];
        let duplicateCount = 0;
        
        // --- Calculate Summary for ALL DATA (Raw Excel File) ---
        let totalOmset = 0;
        let totalOmsetGross = 0;
        const summaryByDate: Record<string, {
            date: string,
            transactionsCount: number,
            totalOmset: number,
            totalOmsetGross: number,
            itemSalesTrackerMap: Record<string, { systemName: string, offline: number, food_apps: number, tiktok: number }>
        }> = {};

        ordersMap.forEach((order, receipt) => {
            totalOmset += order.total_amount;
            totalOmsetGross += order.gross_amount;
            const dateKey = order.created_at.split('T')[0];
            
            if (!summaryByDate[dateKey]) {
                summaryByDate[dateKey] = {
                    date: dateKey,
                    transactionsCount: 0,
                    totalOmset: 0,
                    totalOmsetGross: 0,
                    itemSalesTrackerMap: {}
                };
            }
            summaryByDate[dateKey].transactionsCount++;
            summaryByDate[dateKey].totalOmset += order.total_amount;
            summaryByDate[dateKey].totalOmsetGross += order.gross_amount;
            
            order.items.forEach((item: any) => {
                const sName = item._systemName;
                if (!summaryByDate[dateKey].itemSalesTrackerMap[sName]) {
                    summaryByDate[dateKey].itemSalesTrackerMap[sName] = { systemName: sName, offline: 0, food_apps: 0, tiktok: 0 };
                }
                if (order.channel === 'pos') summaryByDate[dateKey].itemSalesTrackerMap[sName].offline += item.quantity;
                else if (order.channel === 'food_apps') summaryByDate[dateKey].itemSalesTrackerMap[sName].food_apps += item.quantity;
                else if (order.channel === 'tiktok') summaryByDate[dateKey].itemSalesTrackerMap[sName].tiktok += item.quantity;
            });

            if (!existingReceipts.has(receipt)) {
                const { items, gross_amount, ...orderData } = order;
                ordersToInsert.push(orderData);
                // Remove _systemName before insert
                items.forEach((i: any) => delete i._systemName);
                itemsToInsert.push(...items);
            } else {
                duplicateCount++;
            }
        });

        return {
            success: true,
            summary: {
                totalTransactionsParsed: ordersMap.size,
                duplicatesSkipped: duplicateCount,
                transactionsToInsert: ordersToInsert.length,
                totalOmset: totalOmset,
                totalOmsetGross: totalOmsetGross,
                itemSalesTracker: Object.values(itemSalesTracker),
                byDate: Object.values(summaryByDate).map(s => ({
                    ...s,
                    itemSalesTracker: Object.values(s.itemSalesTrackerMap)
                }))
            },
            data: {
                orders: ordersToInsert,
                items: itemsToInsert
            }
        };

    } catch (err: any) {
        return { success: false, error: err.message || "Unknown error" };
    }
}

export async function syncPawoonData(orders: any[], items: any[]) {
    try {
        if (orders.length === 0) return { success: true, message: "No data to insert" };

        const { error: errOrders } = await supabase.from('orders').insert(orders);
        if (errOrders) throw new Error("Failed to insert orders: " + errOrders.message);
        
        const { error: errItems } = await supabase.from('order_items').insert(items);
        if (errItems) throw new Error("Failed to insert items: " + errItems.message);
        
        return { success: true, insertedOrders: orders.length };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
