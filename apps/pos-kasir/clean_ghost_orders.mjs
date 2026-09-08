import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Daftar lengkap 55 target Ghost Orders hasil audit forensik 18-19 Agustus 2026
const TARGET_ORDERS = [
  // 1. BEJI (2 order cash duplikat dari QRIS #38 & #36)
  { id: '792ea9ad-0480-4380-a0d3-196c5a29219c', outlet: 'Beji', order_number: 47, customer: 'ka taufik ', amount: 29000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah QRIS Order #38)' },
  { id: '6a7b85fc-88ab-4edc-b9ca-4acd433eb991', outlet: 'Beji', order_number: 49, customer: 'kak aldi ', amount: 50000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah QRIS Order #36)' },

  // 2. CIRENDEU (1 order cash duplikat dari QRIS #11 Dongki)
  { id: '1ed89b96-0a49-441e-9dfd-708c7fc3f477', outlet: 'Cirendeu', order_number: 37, customer: 'dongkil', amount: 27000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah QRIS Order #11 Dongki)' },

  // 3. SAWANGAN (2 order cash duplikat dari Web POS Cash #13 & #8)
  { id: '98177891-b119-4e40-b959-ad5ad3a2f5f1', outlet: 'Sawangan', order_number: 41, customer: 'lia', amount: 58000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS Order #13 Lia)' },
  { id: '2ec9c1a4-2d43-49d7-ba87-986c192c0ae4', outlet: 'Sawangan', order_number: 46, customer: 'alan', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS Order #8 Alan)' },

  // 4. CIBUBUR (2 order cash testing dummy)
  { id: 'd40c0c9e-59bc-4245-baef-892f40be788f', outlet: 'Cibubur', order_number: 46, customer: 'kakaka', amount: 64000, reason: 'Order fiktif/dummy testing terunggah late sync 19 Agt' },
  { id: 'a81dda93-862f-4a5a-b599-aadd61cd0821', outlet: 'Cibubur', order_number: 51, customer: 'kokokooo', amount: 58000, reason: 'Order fiktif/dummy testing terunggah late sync 19 Agt' },

  // 5. CISEENG (1 order cash duplikat dari Web POS Cash #10 Pa rido)
  { id: '863b8d5d-0605-48e2-81ff-7270cc92bd85', outlet: 'Ciseeng', order_number: 23, customer: 'rido', amount: 68000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS Order #10 Pa rido)' },

  // 6. KALISARI (2 order cash double input sesi sore)
  { id: '1576b774-8992-4870-b124-688225520cec', outlet: 'Kalisari', order_number: 20, customer: 'lia', amount: 42000, reason: 'Double input kasir sesi sore (transaksi sah Order #15 Lia)' },
  { id: '6d40537a-c357-4a4d-a227-ffc7e88db0a6', outlet: 'Kalisari', order_number: 24, customer: 'anggi', amount: 81000, reason: 'Double input kasir sesi sore (transaksi sah Order #14 Anggi)' },

  // 7. SENTUL (19 order native batch duplikat dari Web POS #24 s/d #44)
  { id: '351a43a6-c6b3-4b36-8a3c-72c0acb898e3', outlet: 'Sentul', order_number: 45, customer: 'rehan', amount: 37000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #24 Rehan)' },
  { id: '62e2920d-9ddc-4d35-bcbd-12d500173428', outlet: 'Sentul', order_number: 46, customer: 'rafli', amount: 30000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #25 Rafli)' },
  { id: '971d4b51-eabe-4628-9c13-51264633650a', outlet: 'Sentul', order_number: 47, customer: 'nono', amount: 54000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #38 Nono)' },
  { id: 'e6e276a3-81dc-4efa-9ba6-62f6a5bb8738', outlet: 'Sentul', order_number: 48, customer: 'utek', amount: 29000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #39 Utek)' },
  { id: '6add1f1d-0d16-40f3-84ae-a248887b5230', outlet: 'Sentul', order_number: 49, customer: 'silvi', amount: 68000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '63fd9920-8110-40fd-9d9a-36a081988a00', outlet: 'Sentul', order_number: 50, customer: 'reham', amount: 24000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #43 Rehn)' },
  { id: '93188156-4263-46b0-beb2-8a869a28fcee', outlet: 'Sentul', order_number: 51, customer: 'ica', amount: 37000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #44 Ica)' },
  { id: 'd8f0f292-42bc-4686-aee6-b343f3c75ca1', outlet: 'Sentul', order_number: 52, customer: 'beni', amount: 41000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #27 Beni)' },
  { id: '95b6d3bc-a04f-4a0a-92ab-680fe36bd169', outlet: 'Sentul', order_number: 53, customer: 'bastian', amount: 56000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #42 Bastian)' },
  { id: '1687edd7-4fb9-42c3-8b26-b5562095315b', outlet: 'Sentul', order_number: 54, customer: 'arul', amount: 42000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #40 Arul)' },
  { id: '4150ffad-497e-48d5-92a2-1ab1604ca669', outlet: 'Sentul', order_number: 55, customer: 'hano', amount: 37000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #41 Hano)' },
  { id: 'b4fed528-b0c4-452c-945f-56dd0b70ea8f', outlet: 'Sentul', order_number: 56, customer: 'dimas', amount: 34000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #28 Dimas)' },
  { id: '06400af4-7aad-4b44-baa0-5c8e0ff2307a', outlet: 'Sentul', order_number: 57, customer: 'angga', amount: 128000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #30 Angga)' },
  { id: '77764b34-a6d0-4d2d-89cc-37d242e08888', outlet: 'Sentul', order_number: 58, customer: 'taufan', amount: 39000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'e6606f2a-fb46-4b4f-8e39-ba12cb10d4c9', outlet: 'Sentul', order_number: 59, customer: 'aldi', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #35 Aldi)' },
  { id: '5c1a2aef-0105-448c-9f52-9609b509dfd9', outlet: 'Sentul', order_number: 60, customer: 'iin', amount: 27000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #36 IIn)' },
  { id: '1cffd54a-6130-4b25-8d08-b77c54348c00', outlet: 'Sentul', order_number: 61, customer: 'nis', amount: 51000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #37 Anis)' },
  { id: '3b741af8-c9d6-41f5-af5c-b7f5bdd23723', outlet: 'Sentul', order_number: 62, customer: 'fahira', amount: 56000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #31 Fahira)' },
  { id: 'bec06e97-e23d-4663-93ab-c34550f7a2af', outlet: 'Sentul', order_number: 63, customer: 'deri', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #32 Deri)' },

  // 8. EMPANG (26 order native batch duplikat dari Web POS sore)
  { id: '2b2dea09-b432-455c-a2f1-7c23d4c1843d', outlet: 'Empang', order_number: 192, customer: 'riski', amount: 92000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #97 Riski)' },
  { id: 'd80ffe8d-3fa1-496f-bbd4-be2f95f47e8a', outlet: 'Empang', order_number: 193, customer: 'rendi', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'e626443d-93c2-4913-8d32-d34df0aa733d', outlet: 'Empang', order_number: 194, customer: 'rihano', amount: 34000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #31 Rihano)' },
  { id: 'd694a58f-41c5-425e-a148-708e80984c0d', outlet: 'Empang', order_number: 195, customer: 'rihan', amount: 34000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #32 Rihan)' },
  { id: 'cb008ca5-092f-442d-94eb-0960c37a39be', outlet: 'Empang', order_number: 196, customer: '261 yoga', amount: 41000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '9768cec6-3e40-4434-95ec-17537d4180d3', outlet: 'Empang', order_number: 197, customer: '262 fitry', amount: 33000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'c6d4427c-1041-44ce-8333-c9df5c701c0a', outlet: 'Empang', order_number: 198, customer: '263 adis', amount: 39000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '1a306c21-6c97-4746-aead-44224ac0d2f9', outlet: 'Empang', order_number: 199, customer: '264 dea', amount: 94000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '15737a2a-b509-42b6-a7c9-185009ec2b65', outlet: 'Empang', order_number: 200, customer: 'ayu', amount: 41000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #33 Ayu)' },
  { id: 'c2ef9ffa-68da-4d2b-b304-8f3d78c93574', outlet: 'Empang', order_number: 201, customer: 'ajiz', amount: 41000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #34 Ajiz)' },
  { id: '46e2c266-6d63-423c-a637-cabf7ce82f05', outlet: 'Empang', order_number: 202, customer: 'rian', amount: 53000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #35 Rian)' },
  { id: '3ce28607-bc38-4854-80ce-a273f992f546', outlet: 'Empang', order_number: 203, customer: '1edas 1 pedit', amount: 48000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'a1910d43-7860-4357-9cf4-6c0b3c9c1432', outlet: 'Empang', order_number: 204, customer: 'randy', amount: 57000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'fc6e8c77-62b3-4438-8f9d-1de5410d7662', outlet: 'Empang', order_number: 205, customer: 'julie', amount: 66000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '38605ee2-2161-4d41-abae-877fd13edde9', outlet: 'Empang', order_number: 206, customer: 'a', amount: 24000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: '623575d7-3082-449f-aa35-8bbce418fcaf', outlet: 'Empang', order_number: 207, customer: 'pano', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #94 Pano)' },
  { id: '7bb8fe33-6de7-4444-acee-16f9461431f7', outlet: 'Empang', order_number: 208, customer: 'delisa', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #92 Delisa)' },
  { id: '24590e7a-275e-4918-ad64-6b34dc4dd62e', outlet: 'Empang', order_number: 209, customer: 'emon', amount: 24000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #91 Emon)' },
  { id: 'f90c9891-6f7d-493c-bd5d-b6c4be82eeb9', outlet: 'Empang', order_number: 210, customer: 'eko', amount: 59000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'c1b019b2-31b7-4f83-b3fe-b8ab6957644b', outlet: 'Empang', order_number: 211, customer: '266andhika', amount: 45000, reason: 'Duplikat sync native tablet 19 Agt' },
  { id: 'd626143b-1fd9-4904-bf52-9c2ec00ff3b8', outlet: 'Empang', order_number: 212, customer: 'aa', amount: 29000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #37 Aa)' },
  { id: 'aafc1cb4-5973-4c83-b413-84811ffb69e7', outlet: 'Empang', order_number: 213, customer: 'sidik', amount: 24000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #39 Sidik)' },
  { id: '5142b32c-9703-47ad-b840-f1e01ffee870', outlet: 'Empang', order_number: 214, customer: 'gabril', amount: 74000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #40 Gabril)' },
  { id: 'eebb5ec7-d4ca-4761-9dd3-fe0a68da544c', outlet: 'Empang', order_number: 215, customer: 'ar', amount: 48000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #43 Arab mobil)' },
  { id: '2cb22758-1b1f-461f-875d-0f096bfa3ea7', outlet: 'Empang', order_number: 216, customer: 'segaf', amount: 32000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #23 Segaf)' },
  { id: '3834f8d1-211d-48cd-b092-d59b2763301a', outlet: 'Empang', order_number: 217, customer: 'pak', amount: 108000, reason: 'Duplikat sync native tablet 19 Agt (transaksi sah Web POS #44 Pak)' },
];

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log(`\n🔍 Memulai proses pembersihan Ghost Orders (Mode: ${isExecute ? '🚀 EXECUTE' : '🧪 DRY RUN'})...\n`);
  console.log(`Total target order: ${TARGET_ORDERS.length}`);

  const targetIds = TARGET_ORDERS.map(o => o.id);

  // 1. Ambil kondisi eksisting di DB
  const { data: currentRows, error: fetchErr } = await supabase
    .from('orders')
    .select('id, outlet_id, order_number, customer_name, total_amount, payment_method, status, cancellation_status')
    .in('id', targetIds);

  if (fetchErr) {
    console.error('❌ Gagal mengambil data eksisting:', fetchErr);
    process.exit(1);
  }

  console.log(`Berhasil memverifikasi ${currentRows.length} dari ${TARGET_ORDERS.length} order di database.\n`);

  const rowMap = new Map(currentRows.map(r => [r.id, r]));

  let totalCashAmount = 0;
  let totalNonCashAmount = 0;
  let alreadyCancelledCount = 0;
  let toUpdateCount = 0;

  for (const t of TARGET_ORDERS) {
    const existing = rowMap.get(t.id);
    if (!existing) {
      console.warn(`⚠️ Warning: Order ${t.id} (#${t.order_number} ${t.outlet}) tidak ditemukan di DB!`);
      continue;
    }

    if (existing.payment_method === 'cash') {
      totalCashAmount += existing.total_amount;
    } else {
      totalNonCashAmount += existing.total_amount;
    }

    const isCancelled = existing.status === 'cancelled';
    if (isCancelled) {
      alreadyCancelledCount++;
    } else {
      toUpdateCount++;
    }

    console.log(
      `[${existing.status.toUpperCase()}] Outlet: ${t.outlet.padEnd(10)} | #${String(existing.order_number).padEnd(4)} | ` +
      `${existing.customer_name.padEnd(15)} | ${existing.payment_method.padEnd(5)} | ` +
      `Rp ${String(existing.total_amount).padStart(7)} | ${t.reason}`
    );
  }

  console.log('\n================ RINGKASAN ================');
  console.log(`Total Order Target       : ${TARGET_ORDERS.length}`);
  console.log(`Ditemukan di Database    : ${currentRows.length}`);
  console.log(`Status Saat Ini Active   : ${toUpdateCount}`);
  console.log(`Sudah Berstatus Cancelled: ${alreadyCancelledCount}`);
  console.log(`Total Nilai Cash         : Rp ${totalCashAmount.toLocaleString('id-ID')}`);
  console.log(`Total Nilai Non-Cash     : Rp ${totalNonCashAmount.toLocaleString('id-ID')}`);
  console.log(`Grand Total Nilai Ghost  : Rp ${(totalCashAmount + totalNonCashAmount).toLocaleString('id-ID')}`);
  console.log('===========================================\n');

  if (!isExecute) {
    console.log('💡 Ini adalah DRY RUN. Tidak ada perubahan yang disimpan ke database.');
    console.log('Jalankan dengan flag --execute untuk menerapkan perubahan.');
    return;
  }

  console.log('⚡ Menjalankan pembatalan/void order di database...');
  const now = new Date().toISOString();

  let successCount = 0;
  let failCount = 0;

  for (const t of TARGET_ORDERS) {
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_status: 'approved',
        cancellation_reason: `Ghost Order Duplikat Offline Sync 18-19 Agt (Audit Forensik: ${t.reason})`,
        void_reason: `Ghost Order Duplikat Offline Sync 18-19 Agt (Audit Forensik: ${t.reason})`,
        void_at: now,
        updated_at: now,
      })
      .eq('id', t.id);

    if (updateErr) {
      console.error(`❌ Gagal update order #${t.order_number} (${t.id}):`, updateErr);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\n✅ Pembersihan Selesai:`);
  console.log(`Berhasil di-void : ${successCount} order`);
  console.log(`Gagal           : ${failCount} order\n`);
}

main();
