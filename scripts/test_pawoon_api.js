// Script Laporan Lengkap Pawoon — Per Outlet, Per Hari, Per Menu & Kategori
// Jalankan: node scripts/test_pawoon_api.js

require('dotenv').config({ path: '.env.local' });

async function getPawoonToken(appId, secretKey) {
  const res = await fetch('https://open-api.pawoon.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: appId, client_secret: secretKey })
  });
  if (!res.ok) throw new Error(`Gagal Token: ${res.status}`);
  return (await res.json()).access_token;
}

async function apiFetch(url, headers) {
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${url}`);
  return res.json();
}

async function fetchAllPages(baseUrl, headers) {
  let all = [], page = 1;
  while (true) {
    const data = await apiFetch(`${baseUrl}&page=${page}&per_page=100`, headers);
    const items = data.data || [];
    all = all.concat(items);
    if (items.length < 100) break;
    page++;
  }
  return all;
}

async function fetchPawoonData() {
  try {
    const APP_ID     = process.env.PAWOON_APP_ID     || 'MASUKKAN_APP_ID_DISINI';
    const SECRET_KEY = process.env.PAWOON_SECRET_KEY || 'MASUKKAN_SECRET_KEY_DISINI';

    console.log('🔐 Meminta Access Token...');
    const TOKEN = await getPawoonToken(APP_ID, SECRET_KEY);
    console.log('✅ Token berhasil!\n');

    const H = { 'Accept': 'application/json', 'Authorization': `Bearer ${TOKEN}` };

    // --- KONFIGURASI ---
    const START = '2026-07-01T00:00:00';
    const END   = '2026-07-31T23:59:59';

    // ==========================================
    // 1. AMBIL SEMUA OUTLET
    // ==========================================
    console.log('🏪 Mengambil data Outlet...');
    const outletData = await apiFetch('https://open-api.pawoon.com/outlets?per_page=100&page=1', H);
    const outlets = outletData.data || [];

    console.log(`\n========== DAFTAR OUTLET (${outlets.length}) ==========`);
    outlets.forEach((o, i) => {
      console.log(`${i + 1}. [${o.id}] ${o.name} — ${o.address ?? '-'}`);
    });

    // ==========================================
    // 2. LAPORAN PER OUTLET
    // ==========================================
    for (const outlet of outlets) {
      const oId = outlet.id;
      const oName = outlet.name;
      const outletParam = `&outlet_id=${oId}`;

      console.log(`\n\n${'='.repeat(60)}`);
      console.log(`🏪 OUTLET: ${oName}`);
      console.log(`${'='.repeat(60)}`);

      // --- 2a. Ringkasan Bulanan per Outlet ---
      const summaryData = await apiFetch(
        `https://open-api.pawoon.com/reports/summary?start_datetime=${START}&end_datetime=${END}${outletParam}`, H
      );
      const s = summaryData.data;
      console.log('\n📊 Ringkasan Juli 2026:');
      console.log(`   Gross Sales  : Rp ${(s?.gross_sales ?? 0).toLocaleString('id-ID')}`);
      console.log(`   Diskon       : Rp ${(s?.discount ?? 0).toLocaleString('id-ID')}`);
      console.log(`   Net Sales    : Rp ${(s?.net_sales ?? 0).toLocaleString('id-ID')}`);

      // --- 2b. Transaksi per Hari per Outlet ---
      console.log('\n📅 Menarik detail transaksi harian...');
      const transactions = await fetchAllPages(
        `https://open-api.pawoon.com/transactions?start_device_timestamp=${START}&end_device_timestamp=${END}${outletParam}`, H
      );

      // Kelompokkan per tanggal
      const dailyMap = {};
      for (const tx of transactions) {
        const date = tx.device_timestamp?.substring(0, 10) ?? 'unknown';
        if (!dailyMap[date]) dailyMap[date] = { count: 0, total: 0, discount: 0 };
        dailyMap[date].count    += 1;
        dailyMap[date].total    += tx.final_amount ?? 0;
        dailyMap[date].discount += tx.total_discount ?? 0;
      }

      const sortedDates = Object.keys(dailyMap).sort();
      console.log('\n   Tanggal       | Struk | Total Penjualan    | Diskon');
      console.log('   --------------|-------|--------------------|--------');
      for (const date of sortedDates) {
        const d = dailyMap[date];
        console.log(
          `   ${date}  |  ${String(d.count).padStart(4)} | Rp ${String((d.total).toLocaleString('id-ID')).padStart(16)} | Rp ${d.discount.toLocaleString('id-ID')}`
        );
      }
      if (sortedDates.length === 0) console.log('   (Tidak ada transaksi di periode ini)');

      // --- 2c. Penjualan per Menu & Kategori per Outlet ---
      console.log('\n🍽️  Menarik data penjualan per menu & kategori...');
      const productData = await apiFetch(
        `https://open-api.pawoon.com/reports/product-sales?start_datetime=${START}&end_datetime=${END}&per_page=50&page=1${outletParam}`, H
      );
      const products = productData.data || [];

      if (products.length > 0) {
        console.log('\n🔍 DEBUG: Struktur Data Product Sales Mentah (Item Pertama):');
        console.log(JSON.stringify(products[0], null, 2));
        console.log('Kunci yang tersedia:', Object.keys(products[0]).join(', '));
      }

      // Kelompokkan per Kategori
      const categoryMap = {};
      for (const p of products) {
        const cats = p.category?.name || 'Tanpa Kategori';
        if (!categoryMap[cats]) categoryMap[cats] = [];
        categoryMap[cats].push(p);
      }

      console.log('\n   --- Penjualan per Kategori & Menu ---');
      for (const [cat, items] of Object.entries(categoryMap)) {
        console.log(`\n   📂 Kategori: ${cat}`);
        items.forEach((item, i) => {
          const qty = item.number_of_items ?? '-';
          const totalVal = item.net_sales ?? item.gross_sales ?? 0;
          const total = totalVal.toLocaleString('id-ID');
          console.log(`      ${String(i + 1).padStart(2)}. ${(item.name ?? '-').padEnd(35)} | Qty: ${String(qty).padStart(5)} | Rp ${total}`);
        });
      }
      if (products.length === 0) console.log('   (Tidak ada data menu di periode ini)');
    }

    console.log('\n\n✅ Selesai! Semua laporan berhasil ditampilkan.');

  } catch (error) {
    console.error('❌ Terjadi Kesalahan:', error.message);
  }
}

fetchPawoonData();
