// @ts-nocheck
'use server';

import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { requireRole } from '@/lib/authz';

// Setup Supabase (Server side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function previewPawoonFile(formData: FormData) {
    try {
        // Server Action = endpoint POST publik; import Pawoon adalah operasi
        // admin, bukan sekadar preview tanpa konsekuensi (baca file + query DB).
        await requireRole(['admin', 'owner']);

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
            const normalName = o.name.toLowerCase().replace('suka shawarma ', '').replace('mitra ', '').trim();
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
            // We now process ALL statuses, especially 'Void' which contains negative values
            
            let productName = row[colIdx.product] ? row[colIdx.product].toString().trim() : '';
            if (!productName || productName.startsWith('+')) continue; 

            const rawOutlet = row[colIdx.outlet] ? row[colIdx.outlet].toString().trim() : '';
            let normalOutlet = rawOutlet.toLowerCase().replace('suka shawarma ', '').replace('mitra ', '').trim();
            
            // Fix typo / penamaan beda dari Pawoon
            if (normalOutlet === 'cirendeuu') normalOutlet = 'cirendeu';
            if (normalOutlet === 'kota wisata') normalOutlet = 'cibubur';
            if (normalOutlet === 'depok') normalOutlet = 'depok sukmajaya';
            if (normalOutlet === 'bcc') normalOutlet = 'cimanggu';
            if (normalOutlet === 'pajajarann') normalOutlet = 'pajajaran';
            
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
            const rawTotalCell = row[colIdx.total];
            const rawTotalStr = rawTotalCell != null ? rawTotalCell.toString().trim() : '';
            // PENTING: Jangan pakai || karena 0 itu falsy! Cek dulu apakah sel ada isinya.
            const orderTotal = (rawTotalStr !== '' && rawTotalStr !== '-') ? (parseFloat(rawTotalStr) || 0) : (price * qty);
            const hasExplicitTotal = rawTotalStr !== '' && rawTotalStr !== '-';
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

            // Tentukan channel berdasarkan nama produk/kategori Pawoon
            // PENTING: nilai 'food_apps' adalah tag generik Pawoon, bukan ID channel valid.
            // Simpan sebagai null agar resolveOrderSource pakai sales_source='grabfood' dengan benar.
            let channel: string | null = null;
            let salesSourceTag = 'pos';
            if (productName.includes('FOOD APPS') || category === 'FOOD APPS') {
                channel = null;          // resolveOrderSource akan pakai sales_source
                salesSourceTag = 'grabfood';
            } else if (productName.includes('BEST SELLER - ') || category === 'SS TIKTOK GO') {
                channel = 'tiktokgo';   // tiktokgo terdaftar di CHANNELS[]
                salesSourceTag = 'tiktokgo';
            } else {
                channel = null;
                salesSourceTag = 'pos';
            }

            let orderStatus = 'completed';
            const statusLower = status.toLowerCase();
            if (statusLower === 'void' || statusLower === 'refund') {
                orderStatus = 'cancelled';
            }

            // explicit total = parsed number, or 0 if '-' or empty.
            // This ensures if Pawoon rolls an add-on into a main item, we don't overcount.
            const explicitTotal = (rawTotalStr !== '' && rawTotalStr !== '-') ? (parseFloat(rawTotalStr) || 0) : 0;

            if (!ordersMap.has(receipt)) {
                let rawPayment = row[colIdx.payment] ? row[colIdx.payment].toString().toLowerCase() : 'cash';
                let mappedPayment = 'cash';
                if (rawPayment.includes('qris') || rawPayment.includes('gopay') || rawPayment.includes('ovo') || rawPayment.includes('shopee') || rawPayment.includes('dana') || rawPayment.includes('linkaja')) mappedPayment = 'qris';
                else if (rawPayment.includes('bca') || rawPayment.includes('mandiri') || rawPayment.includes('card') || rawPayment.includes('debit') || rawPayment.includes('kredit')) mappedPayment = 'card';

                ordersMap.set(receipt, {
                    id: uuidv4(),
                    external_order_id: receipt,
                    outlet_id: outletId,
                    source: 'pos',
                    channel: channel,
                    sales_source: salesSourceTag,
                    status: orderStatus,
                    payment_method: mappedPayment,
                    total_amount: Math.abs(explicitTotal), 
                    customer_name: 'Pawoon Import',
                    created_at: isoDate,
                    updated_at: isoDate,
                    raw_total: explicitTotal,
                    gross_amount: (price * qty),
                    _isRefund: statusLower === 'refund',
                    items: []
                });
            } else {
                const existingOrder = ordersMap.get(receipt);
                existingOrder.raw_total += explicitTotal;
                existingOrder.gross_amount += (price * qty);
                existingOrder.total_amount = Math.abs(existingOrder.raw_total);
                // Bug E fix: Jika void row punya receipt ID sama dgn completed,
                // update status agar void tidak ter-ignore
                if (statusLower === 'void' || statusLower === 'refund') {
                    existingOrder.status = 'cancelled';
                    existingOrder._isRefund = statusLower === 'refund';
                }
            }
            
            const order = ordersMap.get(receipt)!;
            // Update channel jika baris ini adalah food_apps atau tiktok (override default pos)
            if (channel !== null) {
                order.channel = channel;
                order.sales_source = salesSourceTag;
            } else if (salesSourceTag !== 'pos') {
                // food_apps: channel tetap null, tapi update sales_source
                order.sales_source = salesSourceTag;
            }

            let remainingQty = Math.abs(qty) || 1;
            const maxPerItem = 10;
            
            while (remainingQty > 0) {
                const chunkQty = Math.min(remainingQty, maxPerItem);
                order.items.push({
                    id: uuidv4(),
                    order_id: order.id,
                    menu_item_id: mapConfig.system_id,
                    menu_item_name: mapConfig.name || mapConfig.system_name || productName,
                    quantity: chunkQty,
                    unit_price: Math.abs(price),
                    subtotal: chunkQty * Math.abs(price),
                    created_at: order.created_at,
                    _systemName: mapConfig.name || mapConfig.system_name || productName
                });
                remainingQty -= chunkQty;
            }
            
            // Tracker logic
            const systemName = mapConfig.name || mapConfig.system_name || productName;
            if (!itemSalesTracker[systemName]) {
                itemSalesTracker[systemName] = { systemName, offline: 0, food_apps: 0, tiktok: 0, totalRevenue: 0 };
            }
            if (salesSourceTag === 'pos') itemSalesTracker[systemName].offline += qty;
            else if (salesSourceTag === 'grabfood') itemSalesTracker[systemName].food_apps += qty;
            else if (salesSourceTag === 'tiktokgo') itemSalesTracker[systemName].tiktok += qty;
            
            itemSalesTracker[systemName].totalRevenue += (qty * price);
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
        let totalVoids = 0;
        let totalOmsetVoid = 0;
        const summaryByDate: Record<string, {
            date: string,
            transactionsCount: number,
            totalOmset: number,
            totalOmsetGross: number,
            itemSalesTrackerMap: Record<string, { systemName: string, offline: number, food_apps: number, tiktok: number, totalRevenue: number }>
        }> = {};

        ordersMap.forEach((order, receipt) => {
            const isCompleted = order.status === 'completed';
            const isRefund = order._isRefund;
            const isCancelled = order.status === 'cancelled';
            
            // Pawoon's Grand Total includes Completed and Refunds/Voids (subtracting them).
            if (isCompleted || isRefund || isCancelled) {
                // Net Omset (Matches Excel Grand Total exactly)
                // Void yang punya explicit total (misal 0) = tidak mengurangi net omset
                // Void yang tidak punya explicit total = pakai gross_amount sebagai pengurang
                let finalTotal: number;
                if (isCancelled || isRefund) {
                    // PAWOON BEHAVIOR: hanya kurangi void yang punya explicit total di kolom Excel.
                    // Void dengan kolom Total kosong = TIDAK dikurangi dari Grand Total (sama persis Pawoon)
                    finalTotal = order.raw_total;
                    if (finalTotal > 0) finalTotal = -finalTotal; // pastikan negatif
                } else {
                    finalTotal = order.raw_total;
                }
                
                totalOmset += finalTotal;

                // Voids
                if (isCancelled && !isRefund) {
                    totalVoids++;
                    let voidAmt = (order.raw_total !== 0) ? Math.abs(order.raw_total) : order.gross_amount;
                    totalOmsetVoid += voidAmt;
                }

                // Gross Omset (Matches Pawoon Dashboard exactly = semua completed)
                if (isCompleted) {
                    totalOmsetGross += order.raw_total;
                }
            }

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
            let dateFinalTotal: number;
            if (isCancelled || isRefund) {
                dateFinalTotal = order.raw_total;
                if (dateFinalTotal > 0) dateFinalTotal = -dateFinalTotal;
            } else {
                dateFinalTotal = order.raw_total;
            }
            summaryByDate[dateKey].totalOmset += dateFinalTotal;
            
            if (isCompleted) {
                summaryByDate[dateKey].totalOmsetGross += order.raw_total;
            }
            
            order.items.forEach((item: any) => {
                const sName = item._systemName;
                if (!summaryByDate[dateKey].itemSalesTrackerMap[sName]) {
                    summaryByDate[dateKey].itemSalesTrackerMap[sName] = { systemName: sName, offline: 0, food_apps: 0, tiktok: 0, totalRevenue: 0 };
                }
                // Bug C+D fix: item.quantity dan item.subtotal di-simpan sebagai Math.abs().
                // Void order harus MENGURANGI qty dan revenue, bukan menambah.
                const qtyEffect = (isCancelled || order._isRefund) ? -item.quantity : item.quantity;
                const revenueEffect = (isCancelled || order._isRefund) ? -item.subtotal : item.subtotal;
                if (order.sales_source === 'pos') summaryByDate[dateKey].itemSalesTrackerMap[sName].offline += qtyEffect;
                else if (order.sales_source === 'grabfood') summaryByDate[dateKey].itemSalesTrackerMap[sName].food_apps += qtyEffect;
                else if (order.sales_source === 'tiktokgo') summaryByDate[dateKey].itemSalesTrackerMap[sName].tiktok += qtyEffect;
                
                summaryByDate[dateKey].itemSalesTrackerMap[sName].totalRevenue += revenueEffect;
            });

            if (!existingReceipts.has(receipt)) {
                const { items, gross_amount, _hasExplicitTotal, raw_total, _isRefund, ...orderData } = order;
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
                totalVoids: totalVoids,
                totalOmsetVoid: totalOmsetVoid,
                duplicatesSkipped: duplicateCount,
                transactionsToInsert: ordersToInsert.length,
                totalOmset: totalOmset,
                totalOmsetGross: totalOmsetGross,
                itemSalesTracker: Object.values(itemSalesTracker),
                byDate: Object.values(summaryByDate).map(s => ({
                    ...s,
                    itemSalesTracker: Object.values(s.itemSalesTrackerMap)
                })),
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
        // Service-role bulk insert langsung ke `orders`/`order_items` — wajib
        // gerbang server-side sendiri, ini bukan operasi read-only.
        await requireRole(['admin', 'owner']);

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

