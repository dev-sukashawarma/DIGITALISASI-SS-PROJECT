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
const shopeeMap = storeMapRaw.shopeefood || { byStoreId: {}, byName: {}, closed: {} };

// Helper parse Indonesian number ("132.000" -> 132000)
function parseIdNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).trim().replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Helper parse MM/DD/YYYY ("10/14/2026 21:40:23" -> "2026-10-14")
function parseSlashDate(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function run() {
  const filePath = 'C:/Users/lu.DESKTOP-HRO3RNS/Downloads/sf-transaction.xlsx';
  console.log('Reading Shopee file:', filePath);
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets['Order_Payment_Details'];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log('Total rows in Order_Payment_Details:', rows.length);

  const header = rows[0].map(h => String(h || '').trim());
  const col = (name) => header.indexOf(name);

  const cStoreId = col('Store ID');
  const cStoreName = col('Store Name');
  const cCreate = col('Order Create Time');
  const cAmount = col('Order Amount');
  const cTotal = col('Total');
  const cCommission = col('Commission');
  const cNetIncome = col('Net Income');
  const cFoodVoucher = col('Merchant Food Voucher Subsidy');
  const cShippingVoucher = col('Merchant Shipping Fee Voucher Subsidy');
  const cDirectDiscount = col('Food Direct Discount');
  const cFlashSale = col('Platform Flash Sale Subsidy');

  console.log('Columns mapped:', {
    cStoreId, cStoreName, cCreate, cAmount, cTotal, cCommission, cNetIncome,
    cFoodVoucher, cShippingVoucher, cDirectDiscount, cFlashSale
  });

  let totalTrx = 0;
  let sumAmount = 0;
  let sumTotal = 0;
  let sumCommission = 0;
  let sumNetIncome = 0;
  let sumFoodVoucher = 0;
  let sumShippingVoucher = 0;
  let sumDirectDiscount = 0;
  let sumFlashSale = 0;

  const fileStores = {};
  const dates = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[cStoreId]) continue;

    const amount = parseIdNumber(r[cAmount]);
    if (amount <= 0) continue;

    const date = parseSlashDate(r[cCreate]);
    if (!date) continue;
    dates.push(date);

    totalTrx++;
    const total = parseIdNumber(r[cTotal]);
    const commission = Math.abs(parseIdNumber(r[cCommission]));
    const netIncome = parseIdNumber(r[cNetIncome]);

    // Breakdown components
    const foodVoucher = cFoodVoucher !== -1 ? parseIdNumber(r[cFoodVoucher]) : 0;
    const shippingVoucher = cShippingVoucher !== -1 ? parseIdNumber(r[cShippingVoucher]) : 0;
    const directDiscount = cDirectDiscount !== -1 ? parseIdNumber(r[cDirectDiscount]) : 0;
    const flashSale = cFlashSale !== -1 ? parseIdNumber(r[cFlashSale]) : 0;

    // Promo merchant = Order Amount - Total
    const promoMerchant = Math.max(0, amount - total);

    sumAmount += amount;
    sumTotal += total;
    sumCommission += commission;
    sumNetIncome += netIncome;
    sumFoodVoucher += foodVoucher;
    sumShippingVoucher += shippingVoucher;
    sumDirectDiscount += directDiscount;
    sumFlashSale += flashSale;

    const sId = String(r[cStoreId]).trim();
    const sName = String(r[cStoreName] ?? '').trim();

    if (!fileStores[sId]) {
      fileStores[sId] = {
        storeId: sId,
        storeName: sName,
        trx: 0,
        amount: 0,
        total: 0,
        promo: 0,
        fee: 0,
        net: 0,
        foodVoucher: 0,
        shippingVoucher: 0,
        directDiscount: 0,
        flashSale: 0,
        dates: {}
      };
    }

    fileStores[sId].trx++;
    fileStores[sId].amount += amount;
    fileStores[sId].total += total;
    fileStores[sId].promo += promoMerchant;
    fileStores[sId].fee += commission;
    fileStores[sId].net += netIncome;
    fileStores[sId].foodVoucher += foodVoucher;
    fileStores[sId].shippingVoucher += shippingVoucher;
    fileStores[sId].directDiscount += directDiscount;
    fileStores[sId].flashSale += flashSale;

    if (!fileStores[sId].dates[date]) fileStores[sId].dates[date] = { trx: 0, amount: 0, promo: 0, fee: 0, net: 0 };
    fileStores[sId].dates[date].trx++;
    fileStores[sId].dates[date].amount += amount;
    fileStores[sId].dates[date].promo += promoMerchant;
    fileStores[sId].dates[date].fee += commission;
    fileStores[sId].dates[date].net += netIncome;
  }

  dates.sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  console.log('\n=== SUMMARY SHOPEEFOOD TRANSACTION FILE ===');
  console.log({
    totalTrx,
    minDate,
    maxDate,
    sumAmount,
    sumPromoMerchant: sumAmount - sumTotal,
    sumCommission,
    sumNetIncome,
    breakdownPromoResto: {
      foodVoucher: sumFoodVoucher,
      shippingVoucher: sumShippingVoucher,
      directDiscount: sumDirectDiscount,
      totalMerchantPromoComponents: sumFoodVoucher + sumShippingVoucher + sumDirectDiscount
    },
    subsidiShopee_BukanBebanResto: {
      platformFlashSale: sumFlashSale
    },
    verificationCalculatedNet: sumAmount - (sumAmount - sumTotal) - sumCommission,
    selisihNet: sumNetIncome - (sumAmount - (sumAmount - sumTotal) - sumCommission),
    storeCount: Object.keys(fileStores).length
  });

  // Also read sf-settlment.xlsx summary sheet to cross-check
  const wbSettlement = xlsx.readFile('C:/Users/lu.DESKTOP-HRO3RNS/Downloads/sf-settlment.xlsx');
  const wsSum = wbSettlement.Sheets['Shopeefood_Settlement_Summary'];
  const sumRows = xlsx.utils.sheet_to_json(wsSum);
  const totalSummaryAmount = sumRows.reduce((s, r) => s + parseIdNumber(r['Total Order Amount']), 0);
  const totalSummaryNet = sumRows.reduce((s, r) => s + parseIdNumber(r['Summary Total Net Income']), 0);
  const totalSummaryComm = sumRows.reduce((s, r) => s + parseIdNumber(r['Total Commission']), 0);
  const totalSummaryOrders = sumRows.reduce((s, r) => s + Number(r['Total Orders'] || 0), 0);

  console.log('\n=== CROSS-CHECK WITH sf-settlment.xlsx (Summary Sheet) ===');
  console.log({
    summarySheetOrders: totalSummaryOrders,
    summarySheetAmount: totalSummaryAmount,
    summarySheetCommission: totalSummaryComm,
    summarySheetNetIncome: totalSummaryNet,
  });

  // DB Outlets mapping
  const { data: dbOutlets } = await supabase.from('outlets').select('id, name, type');
  const outletByName = new Map();
  const outletById = new Map();
  (dbOutlets || []).forEach(o => {
    outletByName.set(o.name.toLowerCase().trim(), o);
    outletById.set(o.id, o);
  });

  const { data: dbMappings } = await supabase.from('platform_store_mapping').select('*').eq('platform', 'shopeefood');
  const dynamicMap = new Map();
  (dbMappings || []).forEach(m => dynamicMap.set(m.store_key.trim(), m.outlet_id));

  for (const sId of Object.keys(fileStores)) {
    const fsItem = fileStores[sId];
    let matchedOutlet = null;

    if (dynamicMap.has(sId)) {
      matchedOutlet = outletById.get(dynamicMap.get(sId));
    }

    const sNameLower = fsItem.storeName.toLowerCase();
    const isSawangan = sId === '21972693' || sNameLower.includes('sawangan');
    let resolvedName = null;

    if (isSawangan) {
      if (maxDate >= '2026-09-20') {
        resolvedName = 'MITRA SAWANGAN DTC';
      } else {
        resolvedName = 'SUKA SHAWARMA SAWANGAN (INTERNAL)';
      }
    } else {
      resolvedName = shopeeMap.byStoreId[sId] || shopeeMap.byName[sNameLower] || null;
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

  // POS Orders for ShopeeFood
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

  const shopeeOrders = posOrders.filter(o => {
    const ch = (o.channel || '').toLowerCase();
    const src = (o.sales_source || '').toLowerCase();
    return ch.includes('shopee') || src.includes('shopee');
  });

  const posByOutlet = {};
  shopeeOrders.forEach(o => {
    const oid = o.outlet_id;
    if (!posByOutlet[oid]) posByOutlet[oid] = { trx: 0, totalAmount: 0, promoSubsidy: 0, discountAmount: 0 };
    posByOutlet[oid].trx++;
    posByOutlet[oid].totalAmount += Number(o.total_amount) || 0;
    posByOutlet[oid].promoSubsidy += Number(o.promo_subsidy) || 0;
    posByOutlet[oid].discountAmount += Number(o.discount_amount) || 0;
  });

  console.log('\nPOS ShopeeFood Orders in DB:', {
    totalTrx: shopeeOrders.length,
    totalAmount: shopeeOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
    totalPromoKasir: shopeeOrders.reduce((s, o) => s + (Number(o.promo_subsidy) || 0), 0),
  });

  // Table output
  const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  console.log('\n| No | Store ID | Nama Toko ShopeeFood | Outlet Sistem SS | Trx File | Omzet File (Kotor) | Promo Resto File | Komisi Shopee | Net Cair File | Trx POS Kasir | Omzet POS Kasir | Promo Kasir | Selisih Omzet |');
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
