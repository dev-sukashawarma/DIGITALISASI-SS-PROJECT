const fs = require('fs');
const path = require('path');
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
const grabMap = storeMapRaw.grabfood || { byStoreId: {}, byName: {}, closed: {} };

// 3. Helper functions from types.ts
const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseTextDate(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

function parsePlainNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const n = parseFloat(String(value).trim());
  return isNaN(n) ? 0 : n;
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function run() {
  const filePath = 'C:/Users/lu.DESKTOP-HRO3RNS/Downloads/grabfood-finance transactionb.csv';
  console.log('Reading file:', filePath);
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsvText(text);
  console.log('Total raw CSV rows:', rows.length);

  if (rows.length < 2) {
    console.error('File kosong!');
    return;
  }

  const header = rows[0].map(h => h.trim());
  const col = (name) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Kolom "${name}" tidak ada di file GrabFood.`);
    return i;
  };

  const cStoreId = col('Store ID');
  const cStoreName = col('Store Name');
  const cCreated = col('Created On');
  const cStatus = col('Status');
  const cAmount = col('Amount');
  const cNetSales = col('Net Sales');
  const cTotal = col('Total');

  console.log('Mapped columns:', { cStoreId, cStoreName, cCreated, cStatus, cAmount, cNetSales, cTotal });

  const statusDistribution = {};
  const fileStores = {};
  const dates = [];

  let transferredTrx = 0;
  let sumAmount = 0;
  let sumNetSales = 0;
  let sumTotal = 0;
  let sumPromoResto = 0;
  let sumKomisiGrab = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < header.length / 2) continue;

    const status = String(r[cStatus] || '').trim().toLowerCase();
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;

    if (status !== 'transferred') continue;

    const omzetKotor = parsePlainNumber(r[cAmount]);
    if (omzetKotor <= 0) continue;

    const date = parseTextDate(r[cCreated]);
    if (!date) continue;
    dates.push(date);

    const netSales = parsePlainNumber(r[cNetSales]);
    const total = parsePlainNumber(r[cTotal]);
    const promoMerchant = Math.max(0, omzetKotor - netSales);
    const commission = Math.max(0, netSales - total);

    transferredTrx++;
    sumAmount += omzetKotor;
    sumNetSales += netSales;
    sumTotal += total;
    sumPromoResto += promoMerchant;
    sumKomisiGrab += commission;

    const sId = String(r[cStoreId] ?? '').trim();
    const sName = String(r[cStoreName] ?? '').trim();

    if (!fileStores[sId]) {
      fileStores[sId] = {
        storeId: sId,
        storeName: sName,
        trx: 0,
        amount: 0,
        netSales: 0,
        promo: 0,
        fee: 0,
        net: 0,
        dates: {}
      };
    }

    fileStores[sId].trx++;
    fileStores[sId].amount += omzetKotor;
    fileStores[sId].netSales += netSales;
    fileStores[sId].promo += promoMerchant;
    fileStores[sId].fee += commission;
    fileStores[sId].net += total;

    if (!fileStores[sId].dates[date]) fileStores[sId].dates[date] = { trx: 0, amount: 0, promo: 0, fee: 0, net: 0 };
    fileStores[sId].dates[date].trx++;
    fileStores[sId].dates[date].amount += omzetKotor;
    fileStores[sId].dates[date].promo += promoMerchant;
    fileStores[sId].dates[date].fee += commission;
    fileStores[sId].dates[date].net += total;
  }

  dates.sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  console.log('\nStatus Distribution:', statusDistribution);
  console.log('\nSummary Grab File:');
  console.log({
    transferredTrx,
    minDate,
    maxDate,
    sumAmount,
    sumNetSales,
    sumPromoResto,
    sumKomisiGrab,
    sumTotalCair: sumTotal,
    verification: sumAmount - sumPromoResto - sumKomisiGrab,
    selisihAritmatika: sumTotal - (sumAmount - sumPromoResto - sumKomisiGrab),
    storeCount: Object.keys(fileStores).length
  });

  // DB Outlets mapping
  const { data: dbOutlets } = await supabase.from('outlets').select('id, name, type');
  const outletByName = new Map();
  const outletById = new Map();
  (dbOutlets || []).forEach(o => {
    outletByName.set(o.name.toLowerCase().trim(), o);
    outletById.set(o.id, o);
  });

  const { data: dbMappings } = await supabase.from('platform_store_mapping').select('*').eq('platform', 'grabfood');
  const dynamicMap = new Map();
  (dbMappings || []).forEach(m => dynamicMap.set(m.store_key.trim(), m.outlet_id));

  for (const sId of Object.keys(fileStores)) {
    const fsItem = fileStores[sId];
    let matchedOutlet = null;

    if (dynamicMap.has(sId)) {
      matchedOutlet = outletById.get(dynamicMap.get(sId));
    }

    const sNameLower = fsItem.storeName.toLowerCase();
    const isSawangan =
      sId === '2b246d96-e506-47f5-b4e2-8e5c68276ed1' ||
      sId === '6-C7LKRP5JKBBGA2' ||
      sNameLower.includes('sawangan') ||
      sNameLower.includes('pancoran mas');
    let resolvedName = null;

    if (isSawangan) {
      if (maxDate >= '2026-09-20') {
        resolvedName = 'MITRA SAWANGAN DTC';
      } else {
        resolvedName = 'SUKA SHAWARMA SAWANGAN (INTERNAL)';
      }
    } else {
      resolvedName = grabMap.byStoreId[sId] || grabMap.byName[sNameLower] || null;
    }

    if (resolvedName) {
      matchedOutlet = outletByName.get(resolvedName.toLowerCase().trim());
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

  // POS Orders for GrabFood
  const fromIso = `${minDate}T00:00:00+07:00`;
  const toIso = `${maxDate}T23:59:59.999+07:00`;

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

  const grabOrders = posOrders.filter(o => {
    const ch = (o.channel || '').toLowerCase();
    const src = (o.sales_source || '').toLowerCase();
    return ch.includes('grab') || src.includes('grab');
  });

  const posByOutlet = {};
  grabOrders.forEach(o => {
    const oid = o.outlet_id;
    if (!posByOutlet[oid]) posByOutlet[oid] = { trx: 0, totalAmount: 0, promoSubsidy: 0, discountAmount: 0 };
    posByOutlet[oid].trx++;
    posByOutlet[oid].totalAmount += Number(o.total_amount) || 0;
    posByOutlet[oid].promoSubsidy += Number(o.promo_subsidy) || 0;
    posByOutlet[oid].discountAmount += Number(o.discount_amount) || 0;
  });

  console.log('\nPOS Grab Orders in DB:', {
    totalTrx: grabOrders.length,
    totalAmount: grabOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
    totalPromoKasir: grabOrders.reduce((s, o) => s + (Number(o.promo_subsidy) || 0), 0),
  });

  // Table output
  const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  console.log('\n| No | Store ID | Nama Toko GrabFood | Outlet Sistem SS | Trx File | Omzet File (Kotor) | Promo Resto File | Komisi Grab File | Net Cair File | Trx POS Kasir | Omzet POS Kasir | Promo Kasir | Selisih Omzet |');
  console.log('|---:|:---|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  let sFileTrx = 0, sFileOmzet = 0, sFilePromo = 0, sFileFee = 0, sFileNet = 0;
  let sPosTrx = 0, sPosOmzet = 0, sPosPromo = 0, sSelisih = 0;

  const storeList = Object.values(fileStores);
  storeList.sort((a, b) => b.amount - a.amount);

  storeList.forEach((s, idx) => {
    const pos = posByOutlet[s.matchedOutletId] || { trx: 0, totalAmount: 0, promoSubsidy: 0 };
    const selisih = s.amount - pos.totalAmount;

    sFileTrx += s.trx;
    sFileOmzet += s.amount;
    sFilePromo += s.promo;
    sFileFee += s.fee;
    sFileNet += s.net;
    sPosTrx += pos.trx;
    sPosOmzet += pos.totalAmount;
    sPosPromo += pos.promoSubsidy;
    sSelisih += selisih;

    console.log(`| ${idx + 1} | ${s.storeId} | ${s.storeName} | ${s.matchedOutletName || 'BELUM TERPETAKAN'} | ${s.trx} | ${rupiah(s.amount)} | ${rupiah(s.promo)} | ${rupiah(s.fee)} | ${rupiah(s.net)} | ${pos.trx} | ${rupiah(pos.totalAmount)} | ${rupiah(pos.promoSubsidy)} | ${(selisih >= 0 ? '+' : '') + rupiah(selisih)} |`);
  });

  console.log(`| | **TOTAL** | | | **${sFileTrx}** | **${rupiah(sFileOmzet)}** | **${rupiah(sFilePromo)}** | **${rupiah(sFileFee)}** | **${rupiah(sFileNet)}** | **${sPosTrx}** | **${rupiah(sPosOmzet)}** | **${rupiah(sPosPromo)}** | **${(sSelisih >= 0 ? '+' : '') + rupiah(sSelisih)}** |`);
}

run().catch(console.error);
