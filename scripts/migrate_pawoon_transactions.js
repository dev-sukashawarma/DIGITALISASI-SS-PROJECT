require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fileArg = args.find(a => !a.startsWith('--'));
const FILE_PATH = fileArg || 'D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\SS COGS SET\\data transaksi pawoon.xls';

async function migrateTransactions() {
    console.log(`Starting Pawoon migration...`);
    console.log(`File: ${FILE_PATH}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (No data will be inserted)' : 'LIVE EXECUTION'}`);

    // Load Mapping
    let itemMap = { mapping: {} };
    try {
        const mapFile = fs.readFileSync('D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\scripts\\pawoon_item_map.json', 'utf8');
        itemMap = JSON.parse(mapFile);
    } catch (e) {
        console.warn("Could not load pawoon_item_map.json. Exiting.");
        return;
    }

    // Load Outlets from DB
    const { data: outletsData } = await supabase.from('outlets').select('id, name');
    const outletIdMap = {}; // name -> id
    outletsData.forEach(o => {
        // Simple normalization for matching
        const normalName = o.name.toLowerCase().replace('suka shawarma ', '').trim();
        outletIdMap[normalName] = o.id;
        // Direct match
        outletIdMap[o.name.toLowerCase()] = o.id;
    });

    // Read XLS
    const workbook = xlsx.readFile(FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIdx = -1;
    for (let i = 0; i < 20; i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('id struk') || rowStr.includes('nama produk')) {
            headerRowIdx = i;
            break;
        }
    }

    if (headerRowIdx === -1) {
        console.error("Could not find table headers in XLS");
        return;
    }

    const headers = data[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase() : '');
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

    // Group by Receipt ID
    const ordersMap = new Map();
    let unmappedItems = new Set();
    let unmappedOutlets = new Set();

    for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[colIdx.receipt]) continue;
        
        const receipt = row[colIdx.receipt].toString().trim();
        const status = row[colIdx.status] ? row[colIdx.status].toString() : '';
        if (status.toLowerCase() !== 'success') continue; // Only process successful orders
        
        let productName = row[colIdx.product] ? row[colIdx.product].toString().trim() : '';
        if (!productName || productName.startsWith('+')) continue; // skip modifiers/empty

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
        const orderTotal = parseFloat(row[colIdx.total]) || (price * qty); // Fallback to item total
        const dateStr = row[colIdx.date] ? row[colIdx.date].toString() : '';
        
        // Parse "15-07-2026 21:56:20" to Date object or ISO
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

        if (!ordersMap.has(receipt)) {
            ordersMap.set(receipt, {
                id: uuidv4(),
                external_order_id: receipt,
                outlet_id: outletId,
                source: 'PAWOON',
                channel: channel,
                sales_source: channel === 'pos' ? 'walk_in' : channel,
                order_status: 'completed',
                payment_status: 'paid',
                payment_method: row[colIdx.payment] ? row[colIdx.payment].toString() : 'Cash',
                total_amount: orderTotal, 
                customer_name: 'Pawoon Import',
                created_at: isoDate,
                items: []
            });
        }
        
        const order = ordersMap.get(receipt);
        // Correct the channel if any item in the order implies an app
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
            subtotal: qty * price
        });
    }

    if (unmappedItems.size > 0 || unmappedOutlets.size > 0) {
        console.error("FATAL ERROR: Found unmapped items or outlets.");
        if (unmappedItems.size > 0) console.log("Unmapped Items:", Array.from(unmappedItems));
        if (unmappedOutlets.size > 0) console.log("Unmapped Outlets:", Array.from(unmappedOutlets));
        console.log("Please update mappings and try again.");
        return;
    }

    console.log(`Parsed ${ordersMap.size} successful transactions from file.`);

    if (DRY_RUN) {
        console.log("Dry run complete. Sample Order:");
        const iter = ordersMap.values();
        console.log(iter.next().value);
        return;
    }

    // Live Execution - Insert into Supabase
    let existingReceipts = new Set();
    const batchSize = 100;
    const receiptsArr = Array.from(ordersMap.keys());
    
    // Check for existing orders
    for (let i = 0; i < receiptsArr.length; i += batchSize) {
        const batch = receiptsArr.slice(i, i + batchSize);
        const { data: existing } = await supabase.from('orders')
            .select('external_order_id')
            .in('external_order_id', batch);
        if (existing) {
            existing.forEach(o => existingReceipts.add(o.external_order_id));
        }
    }

    const ordersToInsert = [];
    const itemsToInsert = [];

    ordersMap.forEach((order, receipt) => {
        if (!existingReceipts.has(receipt)) {
            const { items, ...orderData } = order;
            ordersToInsert.push(orderData);
            itemsToInsert.push(...items);
        }
    });

    console.log(`Skipping ${existingReceipts.size} already existing orders.`);
    console.log(`Ready to insert ${ordersToInsert.length} new orders with ${itemsToInsert.length} items.`);

    if (ordersToInsert.length === 0) {
        console.log("Nothing to insert.");
        return;
    }

    // Insert Orders
    const { error: errOrders } = await supabase.from('orders').insert(ordersToInsert);
    if (errOrders) {
        console.error("Failed to insert orders:", errOrders);
        return;
    }
    
    // Insert Items
    const { error: errItems } = await supabase.from('order_items').insert(itemsToInsert);
    if (errItems) {
        console.error("Failed to insert order items:", errItems);
        return;
    }

    console.log("Migration successful!");
}

migrateTransactions();
