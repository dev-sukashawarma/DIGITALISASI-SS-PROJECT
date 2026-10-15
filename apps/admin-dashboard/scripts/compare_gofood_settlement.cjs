const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// 1. Read env
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Read platform_store_map
const storeMapRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/platform_store_map.json'), 'utf8'));
const gofoodMap = storeMapRaw.gofood || { byStoreId: {}, byName: {}, closed: {} };

// 3. Parse Excel
const wb = xlsx.readFile('C:/Users/lu.DESKTOP-HRO3RNS/Downloads/GOFOOD TEMPLATE.xlsx');
const ws = wb.Sheets['Midtrans Payments'];

function colToNum(letters) {
  let c = 0;
  for (const ch of letters) c = c * 26 + (ch.charCodeAt(0) - 64);
  return c - 1;
}

const cells = [];
for (const key of Object.keys(ws)) {
  if (key.startsWith('!')) continue;
  let m = key.match(/^([A-Z]+)(\d+)$/);
  if (m) cells.push({ r: parseInt(m[2], 10) - 1, c: colToNum(m[1]), v: ws[key].v });
  m = key.match(/^(\d+)([A-Z]+)$/);
  if (m) cells.push({ r: parseInt(m[1], 10) - 1, c: colToNum(m[2]), v: ws[key].v });
}
const maxR = Math.max(...cells.map(x => x.r));
const maxC = Math.max(...cells.map(x => x.c));
const grid = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));
for (const cell of cells) {
  grid[cell.r][cell.c] = cell.v;
}

const header = grid[0].map(h => String(h || '').trim().toLowerCase());
const colIdx = (name) => header.findIndex(h => h.includes(name.toLowerCase()));

const cOutlet = colIdx('outlet name');
const cMerchant = colIdx('merchant id');
const cTime = colIdx('waktu transaksi');
const cAmount = colIdx('amount');
const cNet = colIdx('net amount');
const cGoFoodDisc = colIdx('gofood discount');
const cMerchantPromo = colIdx('merchant promo');
const cTotalFee = colIdx('total fee');

// Group by store
const fileStores = {};

for (let r = 1; r < grid.length; r++) {
  const row = grid[r];
  if (!row) continue;
  const amount = Number(row[cAmount]) || 0;
  if (amount <= 0) continue;

  const net = Number(row[cNet]) || 0;
  const gofoodDisc = Number(row[cGoFoodDisc]) || 0;
  const merchantPromo = Number(row[cMerchantPromo]) || 0;
  const promo = gofoodDisc > 0 ? gofoodDisc : merchantPromo;
  const fee = Number(row[cTotalFee]) || 0;

  const tVal = row[cTime];
  let dateStr = '';
  if (typeof tVal === 'number') {
    const d = xlsx.SSF.parse_date_code(tVal);
    dateStr = d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
  } else {
    dateStr = String(tVal || '').slice(0, 10);
  }

  const sId = String(row[cMerchant] || '').trim();
  const sName = String(row[cOutlet] || '').trim();

  if (!fileStores[sId]) {
    fileStores[sId] = {
      storeId: sId,
      storeName: sName,
      trx: 0,
      amount: 0,
      promo: 0,
      fee: 0,
      net: 0,
      dates: {}
    };
  }
  fileStores[sId].trx++;
  fileStores[sId].amount += amount;
  fileStores[sId].promo += promo;
  fileStores[sId].fee += fee;
  fileStores[sId].net += net;
  if (dateStr) {
    if (!fileStores[sId].dates[dateStr]) fileStores[sId].dates[dateStr] = { trx: 0, amount: 0, promo: 0, fee: 0, net: 0 };
    fileStores[sId].dates[dateStr].trx++;
    fileStores[sId].dates[dateStr].amount += amount;
    fileStores[sId].dates[dateStr].promo += promo;
    fileStores[sId].dates[dateStr].fee += fee;
    fileStores[sId].dates[dateStr].net += net;
  }
}

async function run() {
  // Get all outlets from DB
  const { data: dbOutlets } = await supabase.from('outlets').select('id, name, type');
  const outletByName = new Map();
  const outletById = new Map();
  (dbOutlets || []).forEach(o => {
    outletByName.set(o.name.toLowerCase().trim(), o);
    outletById.set(o.id, o);
  });

  // Get dynamic store mappings
  const { data: dbMappings } = await supabase.from('platform_store_mapping').select('*').eq('platform', 'gofood');
  const dynamicMap = new Map();
  (dbMappings || []).forEach(m => dynamicMap.set(m.store_key.trim(), m.outlet_id));

  // Map each fileStore to an outlet using exact platformSettlement logic
  for (const sId of Object.keys(fileStores)) {
    const fsItem = fileStores[sId];
    let matchedOutlet = null;

    // Check dynamic
    if (dynamicMap.has(sId)) {
      matchedOutlet = outletById.get(dynamicMap.get(sId));
    }

    // Sawangan special transition: date >= 2026-09-20 -> MITRA SAWANGAN DTC
    const sNameLower = fsItem.storeName.toLowerCase();
    const isSawangan = sId === 'G598069695' || sId === '2b246d96-e506-47f5-b4e2-8e5c68276ed1' || sId === '6-C7LKRP5JKBBGA2' || sId === '21972693' || sNameLower.includes('sawangan');

    let resolvedName = null;
    if (isSawangan) {
      resolvedName = 'MITRA SAWANGAN DTC';
    } else {
      resolvedName = gofoodMap.byStoreId[sId] || gofoodMap.byName[sNameLower] || null;
    }

    if (resolvedName) {
      matchedOutlet = outletByName.get(resolvedName.toLowerCase().trim());
      // fallback partial
      if (!matchedOutlet) {
        for (const [name, out] of outletByName.entries()) {
          if (name.includes(resolvedName.toLowerCase().trim()) || resolvedName.toLowerCase().trim().includes(name)) {
            matchedOutlet = out;
            break;
          }
        }
      }
    }

    fsItem.matchedOutletId = matchedOutlet ? matchedOutlet.id : null;
    fsItem.matchedOutletName = matchedOutlet ? matchedOutlet.name : resolvedName;
  }

  // Check existing platform_settlements
  const { data: existingSettlements } = await supabase
    .from('platform_settlements')
    .select('*')
    .eq('platform', 'gofood')
    .gte('tanggal', '2026-10-01')
    .lte('tanggal', '2026-10-14');

  // Check POS orders for GoFood 2026-10-01 to 2026-10-14 with pagination!
  const fromIso = '2026-10-01T00:00:00+07:00';
  const toIso = '2026-10-14T23:59:59.999+07:00';

  let posOrders = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, created_at, status, total_amount, discount_amount, promo_subsidy, channel, sales_source')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .in('status', ['completed', 'settled'])
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching orders:', error);
      break;
    }
    if (!data || data.length === 0) break;
    posOrders = posOrders.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  // Filter GoFood orders
  const goOrders = (posOrders || []).filter(o => {
    const ch = (o.channel || '').toLowerCase();
    const src = (o.sales_source || '').toLowerCase();
    return ch.includes('gofood') || src.includes('gofood') || ch.includes('gojek') || src.includes('gojek') || ch === '1284ac2a-e753-4380-9f32-59219a322459';
  });

  // Aggregate POS orders by outlet
  const posByOutlet = {};
  goOrders.forEach(o => {
    const oid = o.outlet_id;
    if (!posByOutlet[oid]) posByOutlet[oid] = { trx: 0, totalAmount: 0, promoSubsidy: 0, discountAmount: 0 };
    posByOutlet[oid].trx++;
    posByOutlet[oid].totalAmount += Number(o.total_amount) || 0;
    posByOutlet[oid].promoSubsidy += Number(o.promo_subsidy) || 0;
    posByOutlet[oid].discountAmount += Number(o.discount_amount) || 0;
  });

  // Output comparison
  console.log(JSON.stringify({
    fileSummary: {
      totalTrx: Object.values(fileStores).reduce((s, x) => s + x.trx, 0),
      totalOmzet: Object.values(fileStores).reduce((s, x) => s + x.amount, 0),
      totalPromo: Object.values(fileStores).reduce((s, x) => s + x.promo, 0),
      totalKomisi: Object.values(fileStores).reduce((s, x) => s + x.fee, 0),
      totalNet: Object.values(fileStores).reduce((s, x) => s + x.net, 0),
    },
    existingSettlementSummary: {
      rowCount: (existingSettlements || []).length,
      totalOmzet: (existingSettlements || []).reduce((s, x) => s + Number(x.omzet_kotor || 0), 0),
      totalPromo: (existingSettlements || []).reduce((s, x) => s + Number(x.promo_merchant || 0), 0),
      totalKomisi: (existingSettlements || []).reduce((s, x) => s + Number(x.commission || 0), 0),
    },
    posSummary: {
      totalTrx: goOrders.length,
      totalAmount: goOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
      totalPromoKasir: goOrders.reduce((s, o) => s + (Number(o.promo_subsidy) || 0), 0),
      estimatedCommission: Math.round(goOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0) * 0.20)
    },
    stores: Object.values(fileStores).map(s => {
      const pos = posByOutlet[s.matchedOutletId] || { trx: 0, totalAmount: 0, promoSubsidy: 0 };
      return {
        storeId: s.storeId,
        storeName: s.storeName,
        matchedOutletId: s.matchedOutletId,
        matchedOutletName: s.matchedOutletName,
        fileTrx: s.trx,
        fileOmzet: s.amount,
        filePromo: s.promo,
        fileKomisi: s.fee,
        fileNet: s.net,
        posTrx: pos.trx,
        posOmzet: pos.totalAmount,
        posPromo: pos.promoSubsidy,
        selisihOmzet: s.amount - pos.totalAmount,
        selisihTrx: s.trx - pos.trx
      };
    })
  }, null, 2));
}

run().catch(console.error);
