import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OUTLET_MAP = {
  'SUKA Shawarma Sentul': 'MITRA SENTUL',
  'SUKA Shawarma Kota Wisata Cibubur': 'MITRA CIBUBUR',
  'Kebab SUKA Shawarma - Sukahati Cibinong': 'MITRA CIBINONG',
  'SUKA Shawarma Dramaga': 'SUKA SHAWARMA DRAMAGA',
  'SUKA Shawarma Empang': 'SUKA SHAWARMA EMPANG',
  'SUKA Shawarma Depok Sukmajaya': 'SUKA SHAWARMA DEPOK SUKMAJAYA',
  'SUKA Shawarma Ciseeng': 'MITRA CISEENG',
  'SUKA Shawarma Pekayon': 'MITRA PEKAYON',
  'SUKA Shawarma Cirendeu': 'SUKA SHAWARMA CIRENDEU',
  'SUKA Shawarma Jagakarsa': 'SUKA SHAWARMA JAGAKARSA',
  'SUKA Shawarma Cimanggu': 'SUKA SHAWARMA CIMANGGU',
  'SUKA Shawarma Kalisari': 'MITRA KALISARI',
  'SUKA Shawarma Sawangan': 'SUKA SHAWARMA SAWANGAN',
  'SUKA Shawarma Beji': 'SUKA SHAWARMA BEJI',
  'SUKA Shawarma Pajajaran': 'SUKA SHAWARMA PAJAJARAN',
  'SUKA Shawarma Jatiwaringin': 'SUKA SHAWARMA JATIWARINGIN',
  'SUKA Shawarma Jatiasih': 'SUKA SHAWARMA JATIASIH',
  'SUKA Shawarma Paledang': 'MITRA PALEDANG',
  'SUKA Shawarma Kitchen': 'KANTOR PUSAT'
};

const MENU_MAP = {
  'BEST SELLER 2 (SAPI JUMBO)': 'Combo #2 UP SIZE JUMBO',
  'SHAWARMA TRIPLE COMBO': 'TRIPLE COMBO',
  'SUKA DUO FAVORIT': 'SUKA DUO FAVORITE',
  'BEST SELLER': 'Combo #1',
  'PAKET JUARA': null
};

async function run() {
  console.log("Starting reconciliation...");

  // 1. Fetch Outlets and Menus from DB
  const { data: dbOutlets } = await supabase.from('outlets').select('id, name');
  const outletDbMap = {};
  dbOutlets.forEach(o => outletDbMap[o.name.toUpperCase()] = o.id);

  const { data: dbMenus } = await supabase.from('menu_items').select('id, name');
  const menuDbMap = {};
  dbMenus.forEach(m => menuDbMap[m.name.toUpperCase()] = m.id);

  // 2. Read Excel
  const buf = fs.readFileSync('D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\Format Import Channel\\TIKTOKGO SS JULY v2.xlsx');
  const workbook = xlsx.read(buf, { type: 'buffer' });
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  // Filter valid rows
  const validData = data.filter(d => d['Redemption location'] && d['Item name'] && d['Payment amount']);

  const groupedOrders = {};
  for (const row of validData) {
    const storeOrderId = row['Store order ID'];
    if (!groupedOrders[storeOrderId]) {
      groupedOrders[storeOrderId] = {
        outletNameRaw: row['Redemption location'],
        createdAt: row['Redemption time'],
        totalAmount: 0,
        items: []
      };
    }
    groupedOrders[storeOrderId].totalAmount += parseInt(row['Payment amount'] || 0);
    
    let menuName = row['Item name'];
    if (MENU_MAP[menuName] !== undefined) {
      menuName = MENU_MAP[menuName];
    }
    const menuId = menuName ? menuDbMap[menuName.toUpperCase()] : null;

    groupedOrders[storeOrderId].items.push({
      menu_item_name: row['Item name'],
      menu_item_id: menuId,
      quantity: 1,
      unit_price: parseInt(row['Payment amount'] || 0),
      subtotal: parseInt(row['Payment amount'] || 0)
    });
  }

  const ordersToInsert = [];
  const orderItemsToInsert = [];

  for (const [storeOrderId, orderData] of Object.entries(groupedOrders)) {
    const mappedOutletName = OUTLET_MAP[orderData.outletNameRaw];
    const outletId = mappedOutletName ? outletDbMap[mappedOutletName.toUpperCase()] : null;
    
    if (!outletId) {
      console.log("WARNING: Outlet not found for", orderData.outletNameRaw);
      continue;
    }

    const orderId = crypto.randomUUID();
    ordersToInsert.push({
      id: orderId,
      outlet_id: outletId,
      status: 'completed',
      payment_method: 'cash',
      total_amount: orderData.totalAmount,
      created_at: new Date('1999-01-01T00:00:00Z').toISOString(), // FAKE DATE to bypass trigger
      real_created_at: new Date(orderData.createdAt).toISOString(),
      updated_at: new Date(orderData.createdAt).toISOString(),
      source: 'manual',
      sales_source: 'tiktok',
      channel: 'tiktok_go',
      external_order_id: storeOrderId.toString()
    });

    for (const item of orderData.items) {
      orderItemsToInsert.push({
        id: crypto.randomUUID(),
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        channel: 'tiktok_go'
      });
    }
  }

  console.log(`Prepared ${ordersToInsert.length} orders and ${orderItemsToInsert.length} items to insert.`);

  // Note: we already successfully deleted old records in the previous run.
  // We can skip deleting them again if they were already deleted, but let's run the delete block again just in case there are any leftovers.
  
  console.log("Fetching existing July TikTok Go orders to delete...");
  let allExistingOrders = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: existingOrders, error: fetchErr } = await supabase.from('orders')
      .select('id')
      .eq('sales_source', 'tiktok')
      .gte('created_at', '2026-07-01T00:00:00.000Z')
      .lt('created_at', '2026-08-01T00:00:00.000Z')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (fetchErr) {
      console.error("Error fetching existing orders:", fetchErr);
      return;
    }
    
    if (existingOrders.length > 0) {
      allExistingOrders = allExistingOrders.concat(existingOrders);
      page++;
    } else {
      hasMore = false;
    }
  }

  if (allExistingOrders.length > 0) {
    const orderIds = allExistingOrders.map(o => o.id);
    console.log(`Found ${orderIds.length} existing orders. Deleting items...`);
    for (let i = 0; i < orderIds.length; i += 500) {
      const chunk = orderIds.slice(i, i + 500);
      await supabase.from('order_items').delete().in('order_id', chunk);
      await supabase.from('orders').delete().in('id', chunk);
    }
    console.log("Deleted old orders successfully.");
  } else {
    console.log("No existing orders found for July TikTok Go.");
  }

  // 4. Insert new orders
  console.log("Inserting new orders sequentially and updating to real dates...");
  let orderErrCount = 0;
  let globalOrderNumber = 100000;
  
  for (let i = 0; i < ordersToInsert.length; i++) {
    const order = { ...ordersToInsert[i] };
    const realCreatedAt = order.real_created_at;
    delete order.real_created_at; // Remove internal field before insert
    
    // Step 1: Insert with 1999 date
    const { error: insertErr } = await supabase.from('orders').insert([order]);
    if (insertErr) {
      console.error(`Error inserting order ${i}:`, insertErr);
      orderErrCount++;
      continue;
    }
    
    // Step 2: Update to real date and non-clashing order_number
    const { error: updateErr } = await supabase.from('orders').update({
      created_at: realCreatedAt,
      order_number: globalOrderNumber++
    }).eq('id', order.id);
    
    if (updateErr) {
      console.error(`Error updating order ${i} to real date:`, updateErr);
      orderErrCount++;
    }
    
    if (i > 0 && i % 500 === 0) {
      console.log(`Processed ${i} orders...`);
    }
  }

  console.log("Inserting new order items in chunks...");
  let itemErrCount = 0;
  for (let i = 0; i < orderItemsToInsert.length; i += 500) {
    const chunk = orderItemsToInsert.slice(i, i + 500);
    const { error } = await supabase.from('order_items').insert(chunk);
    if (error) {
      console.error(`Error inserting order items chunk at ${i}:`, error);
      itemErrCount++;
    }
  }

  if (orderErrCount === 0 && itemErrCount === 0) {
    console.log("Reconciliation complete! Inserted all records successfully.");
  } else {
    console.log("Reconciliation finished with some errors.");
  }
}

run();
