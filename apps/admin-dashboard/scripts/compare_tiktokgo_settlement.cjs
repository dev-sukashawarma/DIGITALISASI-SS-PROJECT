const xlsx = require('xlsx');
const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const wbO = xlsx.readFile('C:/Users/lu.DESKTOP-HRO3RNS/Downloads/ttgo orders.xlsx');
  const gridO = xlsx.utils.sheet_to_json(wbO.Sheets['order detail'], { header: 1 });
  const headerO = gridO[3];
  const cStatus = headerO.indexOf('Item order status');
  const cRedempTime = headerO.indexOf('Redemption time');
  const cPayO = headerO.indexOf('Payment amount');
  const cPlatO = headerO.indexOf('Platform incentive');
  const cSettO = headerO.indexOf('Settlement amount');
  const cLocO = headerO.indexOf('Redemption location');

  const fileStores = {};
  for (let i = 4; i < gridO.length; i++) {
    const r = gridO[i];
    if (!r) continue;
    if (String(r[cStatus] || '').trim().toLowerCase() !== 'fulfilled') continue;
    const loc = String(r[cLocO] || '').trim();
    const pay = Number(r[cPayO] || 0);
    const plat = Number(r[cPlatO] || 0);
    const sett = Number(r[cSettO] || 0);
    const base = pay + plat;

    if (!fileStores[loc]) fileStores[loc] = { loc, trx: 0, base: 0, pay: 0, plat: 0, sett: 0 };
    fileStores[loc].trx++;
    fileStores[loc].base += base;
    fileStores[loc].pay += pay;
    fileStores[loc].plat += plat;
    fileStores[loc].sett += sett;
  }

  // DB outlets
  const { data: dbOutlets } = await supabase.from('outlets').select('id, name, type');
  const outletByName = new Map();
  (dbOutlets || []).forEach(o => outletByName.set(o.name.toLowerCase().trim(), o));

  // POS orders 1-14 Okt 2026
  let posOrders = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, created_at, status, total_amount, discount_amount, promo_subsidy, channel, sales_source')
      .gte('created_at', '2026-10-01T00:00:00+07:00')
      .lte('created_at', '2026-10-14T23:59:59.999+07:00')
      .in('status', ['completed', 'settled'])
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    posOrders = posOrders.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const ttPosOrders = posOrders.filter(o => {
    const ch = (o.channel || '').toLowerCase();
    const src = (o.sales_source || '').toLowerCase();
    return ch.includes('tiktok') || src.includes('tiktok');
  });

  const posByOutlet = {};
  ttPosOrders.forEach(o => {
    const oid = o.outlet_id;
    if (!posByOutlet[oid]) posByOutlet[oid] = { trx: 0, totalAmount: 0, promoSubsidy: 0 };
    posByOutlet[oid].trx++;
    posByOutlet[oid].totalAmount += Number(o.total_amount) || 0;
    posByOutlet[oid].promoSubsidy += Number(o.promo_subsidy) || 0;
  });

  // Mapping rule for TikTok Go locations
  const mapStoreToOutlet = (loc) => {
    const l = loc.toLowerCase().trim();
    if (l.includes('cileungsi')) return 'MITRA CILEUNGSI';
    if (l.includes('pajajaran')) return 'SUKA SHAWARMA PAJAJARAN';
    if (l.includes('sukahati') || l.includes('cibinong')) return 'MITRA CIBINONG';
    if (l.includes('cibubur')) return 'MITRA CIBUBUR';
    if (l.includes('empang')) return 'SUKA SHAWARMA EMPANG';
    if (l.includes('dramaga')) return 'SUKA SHAWARMA DRAMAGA';
    if (l.includes('bnr') || l.includes('kitchen')) return 'SUKA SHAWARMA BNR';
    if (l.includes('pamulang')) return 'MITRA PAMULANG';
    if (l.includes('ciseeng')) return 'MITRA CISEENG';
    if (l.includes('sentul')) return 'MITRA SENTUL';
    if (l.includes('pekayon')) return 'MITRA PEKAYON';
    if (l.includes('sawangan')) return 'MITRA SAWANGAN DTC';
    if (l.includes('kalisari')) return 'MITRA KALISARI';
    if (l.includes('cirendeu') || l.includes('ciputat')) return 'SUKA SHAWARMA CIRENDEU';
    if (l.includes('beji')) return 'SUKA SHAWARMA BEJI';
    if (l.includes('sukmajaya') || l.includes('depok')) return 'SUKA SHAWARMA DEPOK SUKMAJAYA';
    if (l.includes('cicurug')) return 'MITRA CICURUG';
    if (l.includes('jagakarsa')) return 'SUKA SHAWARMA JAGAKARSA';
    if (l.includes('cimanggu')) return 'SUKA SHAWARMA CIMANGGU';
    if (l.includes('jatiwaringin')) return 'SUKA SHAWARMA JATIWARINGIN';
    return null;
  };

  const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  console.log('| No | Lokasi Penukaran TikTok Go | Outlet Sistem SS | Voucher File | Omzet Base Resto (File) | Subsidi TikTok | Net Settled File | Order POS Kasir | Omzet POS Kasir | Selisih Omzet |');
  console.log('|---:|:---|:---|---:|---:|---:|---:|---:|---:|---:|');

  let tFileTrx = 0, tFileBase = 0, tFilePlat = 0, tFileSett = 0;
  let tPosTrx = 0, tPosOmzet = 0, tSelisih = 0;

  const stores = Object.values(fileStores);
  stores.sort((a, b) => b.base - a.base);

  stores.forEach((s, idx) => {
    const oName = mapStoreToOutlet(s.loc);
    const dbOut = oName ? outletByName.get(oName.toLowerCase().trim()) : null;
    const pos = dbOut && posByOutlet[dbOut.id] ? posByOutlet[dbOut.id] : { trx: 0, totalAmount: 0 };
    const selisih = s.base - pos.totalAmount;

    tFileTrx += s.trx;
    tFileBase += s.base;
    tFilePlat += s.plat;
    tFileSett += s.sett;
    tPosTrx += pos.trx;
    tPosOmzet += pos.totalAmount;
    tSelisih += selisih;

    console.log(`| ${idx + 1} | ${s.loc} | ${dbOut ? dbOut.name : (oName || 'UNMAPPED')} | ${s.trx} | ${rupiah(s.base)} | ${rupiah(s.plat)} | ${rupiah(s.sett)} | ${pos.trx} | ${rupiah(pos.totalAmount)} | ${selisih >= 0 ? '+' : ''}${rupiah(selisih)} |`);
  });

  console.log(`| | **TOTAL** | | **${tFileTrx}** | **${rupiah(tFileBase)}** | **${rupiah(tFilePlat)}** | **${rupiah(tFileSett)}** | **${tPosTrx}** | **${rupiah(tPosOmzet)}** | **${tSelisih >= 0 ? '+' : ''}${rupiah(tSelisih)}** |`);
}

main().catch(console.error);
