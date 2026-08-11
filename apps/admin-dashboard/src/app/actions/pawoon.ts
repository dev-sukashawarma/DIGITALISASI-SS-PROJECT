// @ts-nocheck
'use server';

import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { requireRole } from '@/lib/authz';
import { pawoonMenuOrderIndex } from '@/lib/pawoonMenuOrder';
import { resolvePawoonProductRow } from '@/lib/pawoonProduct';

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

        // Load cutoffs
        const cutoffsPath = path.join(process.cwd(), 'src', 'data', 'outlet_system_start_dates.json');
        let cutoffMap: Record<string, string> = {};
        if (fs.existsSync(cutoffsPath)) {
            cutoffMap = JSON.parse(fs.readFileSync(cutoffsPath, 'utf8'));
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

            // Modifier gratis dibuang, modifier BERBAYAR (mis. " + EXTRA KEJU")
            // diproses sebagai item — nilainya sudah ikut di kolom Total struk,
            // jadi membuangnya membuat order_items lebih kecil dari total_amount.
            // Lihat src/lib/pawoonProduct.ts untuk bukti & angkanya.
            const rowDecision = resolvePawoonProductRow(
                productName,
                parseFloat(row[colIdx.price]) || 0,
                parseInt(row[colIdx.qty]) || 1
            );
            if (rowDecision.action === 'skip') continue;
            productName = rowDecision.lookupName;

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
                const cleanDateStr = dateStr.trim();
                const parts = cleanDateStr.split(/\s+/);
                if (parts.length >= 1) {
                    const datePart = parts[0];
                    const timePart = parts[1] || '00:00:00';
                    const sep = datePart.includes('/') ? '/' : '-';
                    const dparts = datePart.split(sep);
                    if (dparts.length === 3) {
                        let year = dparts[0];
                        let month = dparts[1];
                        let day = dparts[2];
                        if (year.length === 2 || parseInt(year) < 100) {
                            day = dparts[0];
                            month = dparts[1];
                            year = dparts[2];
                        }
                        isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}+07:00`;
                    }
                }
            }

            // Tentukan channel berdasarkan nama produk di Pawoon (SUMBER KEBENARAN)
            // Prefix nama produk di Pawoon adalah penanda channel yang 100% akurat
            let channel: string | null = null;
            let salesSourceTag = 'pos';
            let itemChannel: 'offline' | 'food_apps' | 'tiktok_go' = 'offline';
            if (productName.startsWith('FOOD APPS') || category === 'FOOD APPS') {
                channel = null;
                salesSourceTag = 'grabfood';
                itemChannel = 'food_apps';
            } else if (productName.startsWith('BEST SELLER') || category === 'SS TIKTOK GO') {
                channel = 'tiktokgo';
                salesSourceTag = 'tiktok';
                itemChannel = 'tiktok_go';
            } else {
                channel = null;
                salesSourceTag = 'pos';
                itemChannel = 'offline';
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
                    channel: itemChannel,
                    created_at: order.created_at,
                    _systemName: mapConfig.name || mapConfig.system_name || productName
                });
                remainingQty -= chunkQty;
            }
            
            // Tracker logic
            // NOTE: field ini ("offline", "food_apps", "tiktok") = NET (qty Excel apa adanya, termasuk
            // baris Void yang qty-nya negatif) — cocok untuk validasi terhadap Grand Total Excel.
            // Varian "Completed Only" (metodologi sama dengan Laporan Laba Kotor) dihitung terpisah
            // di bawah setelah ordersMap final (butuh status final per receipt, bukan status per-baris —
            // lihat Bug E fix di atas: 1 receipt bisa punya baris completed + void yang mengubah status
            // order secara keseluruhan). Lihat docs/superpowers/specs/2026-07-29-pawoon-data-discrepancy-analysis.md
            // section 4b untuk kenapa dua definisi ini sengaja dipisah & ditampilkan berdampingan di UI.
            const systemName = mapConfig.name || mapConfig.system_name || productName;
            if (!itemSalesTracker[systemName]) {
                itemSalesTracker[systemName] = { systemName, offline: 0, food_apps: 0, tiktok: 0, totalRevenue: 0, offlineCompleted: 0, food_appsCompleted: 0, tiktokCompleted: 0 };
            }
            if (salesSourceTag === 'pos') itemSalesTracker[systemName].offline += qty;
            else if (['grabfood', 'gofood', 'shopeefood'].includes(salesSourceTag)) itemSalesTracker[systemName].food_apps += qty;
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
        
        // Find existing orders to skip or update
        let existingReceiptsMap = new Map<string, string>(); // receipt -> db order id
        // batchSize 200, JANGAN dinaikkan lagi.
        // `.in()` menaruh seluruh daftar ID di query string. Dengan 1.000 ID URL-nya
        // terlalu panjang dan request-nya gagal (`TypeError: fetch failed`).
        // Diukur 2026-07-31 pada file EMPANG 1.688 struk: batch 1.000 → 1 dari 2
        // batch gagal, duplikat terdeteksi 688 (seharusnya 1.493); batch 500 & 200
        // → 0 gagal, 1.493 tepat.
        const batchSize = 200;
        const receiptsArr = Array.from(ordersMap.keys());

        for (let i = 0; i < receiptsArr.length; i += batchSize) {
            const batch = receiptsArr.slice(i, i + batchSize);
            const { data: existing, error: existErr } = await supabase.from('orders')
                .select('id, external_order_id, status')
                .in('external_order_id', batch);
            // WAJIB diperiksa. Versi lama hanya membaca `data`, sehingga batch yang
            // gagal lolos tanpa jejak dan struk yang SUDAH ada dianggap baru —
            // lalu insert-nya ditolak unique index dan seluruh proses simpan gagal.
            if (existErr) {
                return {
                    success: false,
                    error: `Gagal memeriksa duplikat (batch ${i / batchSize + 1} dari ${Math.ceil(receiptsArr.length / batchSize)}): ${existErr.message}. Preview dihentikan agar tidak menyimpan data dobel.`
                };
            }
            if (existing) {
                existing.forEach(o => existingReceiptsMap.set(o.external_order_id, o.id));
            }
        }
        const existingReceipts = new Set(existingReceiptsMap.keys());

        const ordersToInsert: any[] = [];
        const itemsToInsert: any[] = [];
        const postSystemOrdersToInsert: any[] = [];
        const postSystemItemsToInsert: any[] = [];
        const ordersToVoid: string[] = []; // DB order IDs that need to be updated to cancelled
        let duplicateCount = 0;
        let postSystemSkippedCount = 0;
        let postSystemSkippedOmset = 0;
        
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
            totalVoids: number,
            totalOmsetVoid: number,
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
                    duplicatesSkipped: 0,
                    totalOmset: 0,
                    totalOmsetGross: 0,
                    totalVoids: 0,
                    totalOmsetVoid: 0,
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

            // Void PER TANGGAL — rumusnya harus identik dengan totalOmsetVoid global
            if (isCancelled && !isRefund) {
                summaryByDate[dateKey].totalVoids++;
                summaryByDate[dateKey].totalOmsetVoid +=
                    (order.raw_total !== 0) ? Math.abs(order.raw_total) : order.gross_amount;
            }

            if (isCompleted) {
                summaryByDate[dateKey].totalOmsetGross += order.raw_total;
            }
            
            order.items.forEach((item: any) => {
                const sName = item._systemName;
                if (!summaryByDate[dateKey].itemSalesTrackerMap[sName]) {
                    summaryByDate[dateKey].itemSalesTrackerMap[sName] = { systemName: sName, offline: 0, food_apps: 0, tiktok: 0, totalRevenue: 0, offlineCompleted: 0, food_appsCompleted: 0, tiktokCompleted: 0 };
                }
                const qtyEffect = (isCancelled || order._isRefund) ? -item.quantity : item.quantity;
                const revenueEffect = (isCancelled || order._isRefund) ? -item.subtotal : item.subtotal;
                if (item.channel === 'offline') summaryByDate[dateKey].itemSalesTrackerMap[sName].offline += qtyEffect;
                else if (item.channel === 'food_apps') summaryByDate[dateKey].itemSalesTrackerMap[sName].food_apps += qtyEffect;
                else if (item.channel === 'tiktok_go') summaryByDate[dateKey].itemSalesTrackerMap[sName].tiktok += qtyEffect;

                summaryByDate[dateKey].itemSalesTrackerMap[sName].totalRevenue += revenueEffect;

                if (isCompleted) {
                    if (!itemSalesTracker[sName]) {
                        itemSalesTracker[sName] = { systemName: sName, offline: 0, food_apps: 0, tiktok: 0, totalRevenue: 0, offlineCompleted: 0, food_appsCompleted: 0, tiktokCompleted: 0 };
                    }
                    if (item.channel === 'offline') {
                        itemSalesTracker[sName].offlineCompleted += item.quantity;
                        summaryByDate[dateKey].itemSalesTrackerMap[sName].offlineCompleted += item.quantity;
                    } else if (item.channel === 'food_apps') {
                        itemSalesTracker[sName].food_appsCompleted += item.quantity;
                        summaryByDate[dateKey].itemSalesTrackerMap[sName].food_appsCompleted += item.quantity;
                    } else if (item.channel === 'tiktok_go') {
                        itemSalesTracker[sName].tiktokCompleted += item.quantity;
                        summaryByDate[dateKey].itemSalesTrackerMap[sName].tiktokCompleted += item.quantity;
                    }
                }
            });

            const cutoffDate = cutoffMap[order.outlet_id];
            const isPostSystem = cutoffDate && dateKey >= cutoffDate;

            if (isPostSystem) {
                // Do not add to ordersToInsert, but we still tracked it in summaryByDate for preview
                postSystemSkippedCount++;
                summaryByDate[dateKey].postSystemCount =
                    (summaryByDate[dateKey].postSystemCount || 0) + 1;
                if (isCompleted) {
                    postSystemSkippedOmset += order.raw_total;
                }
                
                // Simpan transaksi yang belum ada di DB ke postSystemOrdersToInsert agar bisa di-force sync jika crew lupa input
                if (!existingReceipts.has(receipt)) {
                    const { items, gross_amount, _hasExplicitTotal, raw_total, _isRefund, ...orderData } = order;
                    postSystemOrdersToInsert.push(orderData);
                    const itemClones = items.map((i: any) => {
                        const { _systemName, ...itemData } = i;
                        return itemData;
                    });
                    postSystemItemsToInsert.push(...itemClones);
                }
            } else if (!existingReceipts.has(receipt)) {
                const { items, gross_amount, _hasExplicitTotal, raw_total, _isRefund, ...orderData } = order;
                ordersToInsert.push(orderData);
                const itemClones = items.map((i: any) => {
                    const { _systemName, ...itemData } = i;
                    return itemData;
                });
                itemsToInsert.push(...itemClones);
            } else {
                duplicateCount++;
                summaryByDate[dateKey].duplicatesSkipped++;
                // If the order already exists in DB but is now void/cancelled in Excel → flag for update
                if ((isCancelled || isRefund)) {
                    const dbOrderId = existingReceiptsMap.get(receipt);
                    if (dbOrderId) ordersToVoid.push(dbOrderId);
                }
            }
        });

        // Isi tanggal yang KOSONG di Pawoon (tidak ada baris sama sekali) di antara
        // tanggal pertama & terakhir yang ADA di file — sebelumnya tanggal-tanggal
        // ini tidak pernah dapat entry `summaryByDate`, sehingga:
        //   1. Tidak muncul di dropdown Filter Tanggal sama sekali (tidak bisa
        //      dipilih untuk validasi).
        //   2. Data "Data Sistem Saat Ini" untuk tanggal itu DIBUANG — query
        //      overlap di bawah SUDAH menariknya dari DB, tapi guard
        //      `if (summaryByDate[localDateStr])` menolaknya karena key belum ada.
        // Contoh nyata: EMPANG DTP 1-30.xls hanya punya baris utk 1-20, 24, 29 —
        // tanggal 21/22/23/25/26/27/28 hilang total dari preview meski mungkin
        // ada aktivitas sistem yang perlu dibandingkan.
        {
            const existingDates = Object.keys(summaryByDate).sort();
            if (existingDates.length > 1) {
                const first = new Date(existingDates[0] + 'T00:00:00Z');
                const last = new Date(existingDates[existingDates.length - 1] + 'T00:00:00Z');
                for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
                    const key = d.toISOString().slice(0, 10);
                    if (!summaryByDate[key]) {
                        summaryByDate[key] = {
                            date: key,
                            transactionsCount: 0,
                            duplicatesSkipped: 0,
                            totalOmset: 0,
                            totalOmsetGross: 0,
                            totalVoids: 0,
                            totalOmsetVoid: 0,
                            itemSalesTrackerMap: {}
                        };
                    }
                }
            }
        }

        // --- Calculate System Overlap (Data Overlap Detection) ---
        const datesInFile = Object.keys(summaryByDate).sort();
        const outletIdsInFile = Array.from(new Set(Array.from(ordersMap.values()).map(o => o.outlet_id).filter(id => id)));
        
        // Keterangan cutoff per outlet yang ada di file — supaya user tahu PERSIS
        // tanggal mana yang jadi batas, bukan cuma diberi tahu "ada yang di-skip".
        // cutoffDate null = outlet belum punya entri di outlet_system_start_dates.json,
        // artinya TIDAK ADA perlindungan duplikasi untuk outlet itu.
        const outletNameById = new Map<string, string>(
            (outletsData || []).map((o: any) => [o.id, o.name])
        );
        const cutoffs = outletIdsInFile.map((id: string) => ({
            outletId: id,
            outletName: outletNameById.get(id) || id,
            cutoffDate: cutoffMap[id] || null,
        }));

        let totalOverlapCount = 0;
        let totalOverlapOmset = 0;
        
        if (datesInFile.length > 0 && outletIdsInFile.length > 0) {
            const minDate = datesInFile[0];
            const maxDate = datesInFile[datesInFile.length - 1];
            
            const { data: menuItemsData } = await supabase.from('menu_items').select('id, name');
            const menuItemsMap = new Map<string, string>();
            if (menuItemsData) {
                menuItemsData.forEach((m: any) => menuItemsMap.set(m.id, m.name));
            }

            // Note: date keys are YYYY-MM-DD local time, but created_at is ISO string UTC
            // So we use a rough bound that covers the local days.
            // "Overlap Sistem" = data yang diinput lewat SISTEM SENDIRI (kasir manual,
            // online, kiosk) pada tanggal yang sama dengan file — gunanya membandingkan
            // omset Pawoon vs input manual.
            //
            // DUA HAL YANG DULU SALAH DI SINI:
            // 1. Hasil import Pawoon sendiri ikut terhitung sebagai "sistem", sehingga
            //    tanggal yang outletnya masih 100% pakai Pawoon tetap tampil punya
            //    "data sistem" (kasus EMPANG 8 Juli 2026: 115 order di DB, SEMUANYA
            //    hasil import Pawoon, 0 input manual). Karena itu di-exclude di sini.
            //    Pakai .or(...) — bukan .neq() — sebab order manual boleh ber-customer_name
            //    NULL, dan `NULL <> 'Pawoon Import'` di SQL bernilai NULL (ikut terbuang).
            // 2. `.limit(10000)` tidak berpengaruh: PostgREST memotong di `max-rows`
            //    (1.000). Untuk file sebulan, sebagian besar tanggal jadi tercacah
            //    separuh — itu sebab angka overlap tak pernah cocok dengan halaman
            //    Laporan. Diganti pagination `.range()` sampai habis.
            const pageSize = 1000;
            const systemSales: any[] = [];
            for (let from = 0; ; from += pageSize) {
                const { data: page, error: pageErr } = await supabase
                    .from('orders')
                    .select('id, created_at, total_amount, status, order_items(menu_item_name, quantity, subtotal, channel, package_choices)')
                    .in('outlet_id', outletIdsInFile)
                    .or('customer_name.is.null,customer_name.neq.Pawoon Import')
                    .gte('created_at', `${minDate}T00:00:00+07:00`)
                    .lte('created_at', `${maxDate}T23:59:59.999+07:00`)
                    .order('created_at', { ascending: true })
                    .range(from, from + pageSize - 1);

                if (pageErr) {
                    return {
                        success: false,
                        error: `Gagal membaca data sistem untuk deteksi overlap: ${pageErr.message}`
                    };
                }
                if (!page || page.length === 0) break;
                systemSales.push(...page);
                if (page.length < pageSize) break;
            }

            if (systemSales) {
                // Group by local date string
                systemSales.forEach(sale => {
                    // Only count completed sales for overlap omset
                    if (sale.status !== 'completed') return;
                    
                    // Simple timezone conversion for grouping (assume UTC+7 format from DB or just split)
                    // The created_at in DB might be UTC, but let's just match the YYYY-MM-DD prefix for simplicity
                    // Alternatively, we use the local date representation.
                    const d = new Date(sale.created_at);
                    // Adjust to UTC+7 (simple approach)
                    d.setHours(d.getHours() + 7);
                    const localDateStr = d.toISOString().split('T')[0];
                    
                    if (summaryByDate[localDateStr]) {
                        if (!summaryByDate[localDateStr].systemOverlap) {
                            summaryByDate[localDateStr].systemOverlap = { 
                                count: 0, 
                                total: 0,
                                itemSalesTrackerMap: {}
                            };
                        }
                        summaryByDate[localDateStr].systemOverlap.count++;
                        summaryByDate[localDateStr].systemOverlap.total += Number(sale.total_amount);
                        
                        totalOverlapCount++;
                        totalOverlapOmset += Number(sale.total_amount);
                        
                        // Aggregate item sales
                        if (sale.order_items && Array.isArray(sale.order_items)) {
                            sale.order_items.forEach((item: any) => {
                                let sName = item.menu_item_name || 'Unknown Item';
                                // Clean up names like "Extra Keju|ID|xxx" or "Menu|PARENT|yyy"
                                sName = sName.split('|')[0].trim();
                                
                                const trackItem = (name: string, qty: number, subtotal: number, channel: string) => {
                                    if (!summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name]) {
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name] = {
                                            systemName: name,
                                            offline: 0, food_apps: 0, tiktok: 0,
                                            totalRevenue: 0, offlineCompleted: 0, food_appsCompleted: 0, tiktokCompleted: 0
                                        };
                                    }
                                    
                                    if (channel === 'offline' || !channel) {
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].offline += qty;
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].offlineCompleted += qty;
                                    } else if (channel === 'food_apps') {
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].food_apps += qty;
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].food_appsCompleted += qty;
                                    } else if (channel === 'tiktok_go') {
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].tiktok += qty;
                                        summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].tiktokCompleted += qty;
                                    }
                                    
                                    summaryByDate[localDateStr].systemOverlap.itemSalesTrackerMap[name].totalRevenue += subtotal;
                                };

                                const qty = Number(item.quantity) || 0;
                                const subtotal = Number(item.subtotal) || 0;
                                
                                // Track the main item
                                trackItem(sName, qty, subtotal, item.channel);
                                
                                // Track addons from package_choices
                                if (item.package_choices && typeof item.package_choices === 'object') {
                                    Object.values(item.package_choices).forEach((choiceId: any) => {
                                        const choiceName = menuItemsMap.get(choiceId);
                                        if (choiceName) {
                                            // Addons within package_choices typically don't have separate subtotals here
                                            // They just inherit the quantity of the parent item
                                            trackItem(choiceName, qty, 0, item.channel);
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }

        const sortByMenuOrder = (a: any, b: any) =>
            pawoonMenuOrderIndex(a.systemName) - pawoonMenuOrderIndex(b.systemName);

        return {
            success: true,
            summary: {
                totalTransactionsParsed: ordersMap.size,
                totalVoids: totalVoids,
                totalOmsetVoid: totalOmsetVoid,
                duplicatesSkipped: duplicateCount,
                postSystemSkippedCount: postSystemSkippedCount,
                postSystemSkippedOmset: postSystemSkippedOmset,
                cutoffs: cutoffs,
                transactionsToInsert: ordersToInsert.length,
                voidStatusUpdates: ordersToVoid.length,
                totalOmset: totalOmset,
                totalOmsetGross: totalOmsetGross,
                totalOverlapCount: totalOverlapCount,
                totalOverlapOmset: totalOverlapOmset,
                itemSalesTracker: Object.values(itemSalesTracker).sort(sortByMenuOrder),
                byDate: Object.values(summaryByDate).map(d => {
                    let sysOverlap = (d as any).systemOverlap || null;
                    if (sysOverlap && sysOverlap.itemSalesTrackerMap) {
                        sysOverlap = {
                            count: sysOverlap.count,
                            total: sysOverlap.total,
                            itemSalesTracker: Object.values(sysOverlap.itemSalesTrackerMap).sort(sortByMenuOrder)
                        };
                    }
                    return {
                        date: d.date,
                        transactionsCount: d.transactionsCount,
                        duplicatesSkipped: (d as any).duplicatesSkipped || 0,
                        totalOmset: d.totalOmset,
                        totalOmsetGross: d.totalOmsetGross,
                        totalVoids: d.totalVoids,
                        totalOmsetVoid: d.totalOmsetVoid,
                        postSystemCount: (d as any).postSystemCount || 0,
                        systemOverlap: sysOverlap,
                        itemSalesTracker: Object.values(d.itemSalesTrackerMap).sort(sortByMenuOrder)
                    };
                }),
            },
            data: {
                orders: ordersToInsert,
                items: itemsToInsert,
                ordersToVoid: ordersToVoid,
                postSystemOrders: postSystemOrdersToInsert,
                postSystemItems: postSystemItemsToInsert
            }
        };

    } catch (err: any) {
        return { success: false, error: err.message || "Unknown error" };
    }
}

export async function syncPawoonData(orders: any[], items: any[], ordersToVoid: string[] = []) {
    try {
        await requireRole(['admin', 'owner']);

        // Update voided orders status
        if (ordersToVoid.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < ordersToVoid.length; i += batchSize) {
                const batch = ordersToVoid.slice(i, i + batchSize);
                const { error: errVoid } = await supabase
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .in('id', batch);
                if (errVoid) throw new Error('Failed to update voided orders: ' + errVoid.message);
            }
        }

        if (orders.length === 0 && ordersToVoid.length === 0) {
            return { success: true, message: 'No data to insert or update' };
        }

        if (orders.length > 0) {
            const { error: errOrders } = await supabase.from('orders').insert(orders);
            if (errOrders) throw new Error('Failed to insert orders: ' + errOrders.message);
            
            const { error: errItems } = await supabase.from('order_items').insert(items);
            if (errItems) throw new Error('Failed to insert items: ' + errItems.message);
        }
        
        return { success: true, insertedOrders: orders.length, voidedOrders: ordersToVoid.length };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getMenuItemsForMapping() {
    try {
        await requireRole(['admin', 'owner']);
        const { data, error } = await supabase
            .from('menu_items')
            .select('id, name')
            .order('name');
        
        if (error) throw new Error(error.message);
        return { success: true, items: data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updatePawoonMapping(newMappings: Record<string, string>) {
    try {
        await requireRole(['admin', 'owner']);
        const mapPath = path.join(process.cwd(), 'src', 'data', 'pawoon_item_map.json');
        
        if (!fs.existsSync(mapPath)) {
            return { success: false, error: "Mapping file not found" };
        }

        const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        
        if (!mapData.mapping) {
            mapData.mapping = {};
        }

        const systemIds = Object.values(newMappings);
        const { data: menuItems, error } = await supabase
            .from('menu_items')
            .select('id, name')
            .in('id', systemIds);

        if (error) throw new Error(error.message);

        const idToNameMap: Record<string, string> = {};
        menuItems.forEach(item => {
            idToNameMap[item.id] = item.name;
        });

        for (const [pawoonName, systemId] of Object.entries(newMappings)) {
            const systemName = idToNameMap[systemId];
            if (systemName) {
                mapData.mapping[pawoonName] = {
                    system_id: systemId,
                    system_name: systemName
                };
            }
        }

        fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 4));
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getOutletsForClear() {
    try {
        await requireRole(['admin', 'owner']);
        const { data, error } = await supabase
            .from('outlets')
            .select('id, name')
            .order('name');
            
        if (error) throw error;
        return { success: true, outlets: data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Hitung berapa order yang AKAN dihapus oleh `clearPawoonDataForOutlet` dengan
 * parameter yang sama persis — dipakai UI untuk menampilkan angka sebelum user
 * mengonfirmasi. Read-only.
 */
export async function countPawoonDataForOutlet(
    outletId: string,
    dateFrom?: string,
    dateTo?: string
) {
    if (!outletId) return { success: false, error: 'Outlet ID is required' };
    try {
        await requireRole(['admin', 'owner']);

        let q = supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('outlet_id', outletId)
            .eq('customer_name', 'Pawoon Import')
            .not('external_order_id', 'is', null);
        if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00+07:00`);
        if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999+07:00`);

        const { count, error } = await q;
        if (error) throw error;
        return { success: true, count: count ?? 0 };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Hapus order hasil import Pawoon untuk 1 outlet.
 *
 * `dateFrom`/`dateTo` (YYYY-MM-DD, waktu Asia/Jakarta) bersifat opsional dan
 * membatasi penghapusan ke rentang tanggal tertentu — use case aslinya adalah
 * membuang hari-hari yang OVERLAP dengan input manual kasir, bukan membuang
 * seluruh riwayat import outlet tersebut. Tanpa rentang, perilakunya tetap
 * seperti semula (hapus semua).
 */
export async function clearPawoonDataForOutlet(
    outletId: string,
    dateFrom?: string,
    dateTo?: string
) {
    if (!outletId) return { success: false, error: 'Outlet ID is required' };

    try {
        // DELETE destruktif dengan service-role client (bypass RLS) — 'use server'
        // bukan berarti privat, lihat komentar di @/lib/authz.
        await requireRole(['admin', 'owner']);

        const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
        if (dateFrom && !isDateOnly(dateFrom)) return { success: false, error: 'Format dateFrom harus YYYY-MM-DD' };
        if (dateTo && !isDateOnly(dateTo)) return { success: false, error: 'Format dateTo harus YYYY-MM-DD' };
        if (dateFrom && dateTo && dateFrom > dateTo) {
            return { success: false, error: 'dateFrom tidak boleh setelah dateTo' };
        }

        // created_at ditulis dengan offset +07:00 saat import, jadi batas rentang
        // juga harus eksplisit +07:00 — kalau tidak, transaksi di sekitar tengah
        // malam ikut/lolos secara tak terduga.
        // FILTER KESELAMATAN — jangan pernah dilonggarkan.
        // `customer_name` saja sudah memisahkan 21.002 order Pawoon dari data lain
        // (audit 2026-07-31: 0 order Pawoon yang tanpa external_order_id), tapi
        // nama customer bisa saja diketik manual oleh kasir. `external_order_id
        // IS NOT NULL` adalah pagar kedua: order yang diinput manual TIDAK PERNAH
        // punya kolom ini terisi, jadi mustahil ikut terhapus.
        const withFilters = (q: any) => {
            q = q
                .eq('outlet_id', outletId)
                .eq('customer_name', 'Pawoon Import')
                .not('external_order_id', 'is', null);
            if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00+07:00`);
            if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999+07:00`);
            return q;
        };

        // AMBIL-LALU-HAPUS BERULANG sampai tidak ada sisa.
        //
        // JANGAN diubah jadi "sekali SELECT semua id lalu hapus": PostgREST
        // memotong hasil SELECT di `max-rows` (1.000 di proyek ini) dan batas itu
        // TIDAK bisa dilampaui dengan .limit() dari client. Versi sebelumnya
        // karena itu berhenti tepat di 1.000 baris dan melaporkannya sebagai
        // sukses — outlet EMPANG tersisa 688 order yang tidak ikut terhapus
        // (kejadian nyata 2026-07-31).
        //
        // Karena tiap putaran menghapus baris yang baru saja diambil, halaman
        // berikutnya selalu diambil dari sisa yang belum terhapus — tidak perlu
        // offset, dan tidak ada baris yang terlewat.
        const pageSize = 500;
        const maxLoops = 500; // pagar anti-loop-tak-berujung (maks 250.000 order)
        let deleted = 0;

        for (let loop = 0; loop < maxLoops; loop++) {
            const { data: page, error: fetchError } = await withFilters(
                supabase.from('orders').select('id').limit(pageSize)
            );
            if (fetchError) {
                throw new Error(`Gagal membaca data (setelah ${deleted} order terhapus): ${fetchError.message}`);
            }
            if (!page || page.length === 0) {
                return { success: true, count: deleted };
            }

            const chunk = page.map(o => o.id);

            // withFilters tetap dipasang walau id-nya sudah hasil filter — supaya
            // tidak ada jalur hapus yang lolos tanpa pagar keselamatan.
            const { error: deleteError } = await withFilters(
                supabase.from('orders').delete().in('id', chunk)
            );

            if (deleteError) {
                // Fallback: manual cascade if foreign key prevents delete
                if (deleteError.code === '23503') {
                    await supabase.from('order_items').delete().in('order_id', chunk);
                    const { error: retryError } = await withFilters(
                        supabase.from('orders').delete().in('id', chunk)
                    );
                    if (retryError) {
                        throw new Error(`Gagal menghapus setelah ${deleted} order terhapus: ${retryError.message}`);
                    }
                } else {
                    throw new Error(`Gagal menghapus setelah ${deleted} order terhapus: ${deleteError.message}`);
                }
            }

            deleted += chunk.length;
        }

        // Sampai di sini = pagar loop tercapai, masih mungkin ada sisa.
        return {
            success: true,
            count: deleted,
            incomplete: true,
            message: `${deleted} order terhapus, tetapi batas pengaman tercapai. Jalankan sekali lagi untuk menghapus sisanya.`
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
