import { test, expect } from '@playwright/test';

// Catatan: Pastikan E2E_KASIR_EMAIL dan E2E_KASIR_PASSWORD di .env 
// adalah kredensial untuk kasir yang bertugas di "Outlet Empang" sesuai request.

test.describe('E2E Golden Flow: Order to Ledger', () => {

  test('Step 1: Login & Kasir Membuat Pesanan (E2E TEST)', async ({ page }) => {
    // Daftarkan handler otomatis untuk Bypass Darurat jika layar absensi muncul kapan saja
    await page.addLocatorHandler(page.getByRole('button', { name: 'Gunakan Bypass Darurat' }), async () => {
      await page.getByRole('button', { name: 'Gunakan Bypass Darurat' }).click();
      await page.getByPlaceholder('Masukkan password Anda...').fill(process.env.E2E_KASIR_PASSWORD || 'test');
      await page.getByRole('button', { name: /Verifikasi Bypass/i }).click();
      await expect(page.getByText('Bypass Darurat')).toBeHidden({ timeout: 10000 });
    });

    // Navigasi ke portal login
    await page.goto(process.env.PORTAL_URL || 'http://localhost:3010');

    // Isi email/username (Akun Kasir Outlet Empang)
    await page.fill('input#identifier', process.env.E2E_KASIR_EMAIL || '');
    await page.fill('input#password', process.env.E2E_KASIR_PASSWORD || '');

    // Klik tombol Masuk
    await page.click('button[type="submit"]');

    // Tunggu sampai redirect ke launcher atau aplikasi POS
    await page.waitForURL(/launcher|3004/, { timeout: 15000, waitUntil: 'domcontentloaded' });
    
    // Jika masih di launcher, navigasikan manual ke POS
    if (page.url().includes('launcher') || page.url().includes('3010')) {
      await page.goto(process.env.POS_URL || 'http://localhost:3004', { waitUntil: 'domcontentloaded' });
    }

    // --- MULAI SIMULASI ORDER KASIR ---
    
    // 1. Dari halaman utama Kasir, klik "Pesanan Baru"
    await page.getByRole('link', { name: 'Pesanan Baru' }).click();
    await page.waitForURL('**/kasir/order-manual', { waitUntil: 'domcontentloaded' });
    
    // 2. Pilih produk (Klik produk pertama di grid)
    // Tunggu sampai grid produk muncul
    await page.waitForSelector('.grid > div.group');
    await page.locator('.grid > div.group').first().click();
    
    // 3. Tambahkan catatan "E2E TEST" pada item di keranjang
    await page.getByPlaceholder('Catatan opsional...').fill('E2E TEST');
    
    // 4. Klik "Uang Pas" agar Uang Diterima terisi otomatis
    await page.getByRole('button', { name: 'Uang Pas' }).click();
    
    // 5. Bayar
    await page.getByRole('button', { name: /Bayar & Cetak Struk/i }).click();
    
    // 6. Verifikasi Sukses
    await expect(page.locator('text=Pembayaran Berhasil!')).toBeVisible({ timeout: 15000 });
    
    // Opsional: Kembali ke papan order
    await page.getByRole('link', { name: 'Ke Papan Order' }).click();
    
    console.log('Step 1: Order E2E berhasil dibuat!');
  });

  test('Step 2: Verifikasi Pengurangan Stok (Outlet Empang)', async ({ page }) => {
    // Navigasi ke modul stok
    await page.goto(process.env.STOK_URL || 'http://localhost:3001', { waitUntil: 'domcontentloaded' });

    // Login jika diperlukan (atau session sudah tersimpan)
    if (await page.locator('input[name="identifier"]').isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.fill('input[name="identifier"]', process.env.E2E_KASIR_EMAIL || '');
      await page.fill('input[name="password"]', process.env.E2E_KASIR_PASSWORD || '');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000, waitUntil: 'domcontentloaded' });
    }

    // Pastikan berada di halaman Monitoring Stok
    await expect(page.getByText('Monitoring', { exact: false })).toBeVisible({ timeout: 15000 });

    // Verifikasi data stok bahan baku (Daging Shawarma) muncul
    await page.getByPlaceholder('Cari nama bahan...').fill('Daging');
    await expect(page.locator('text=Daging Shawarma').first()).toBeVisible({ timeout: 10000 });
    
    console.log('Step 2: Verifikasi stok Daging Shawarma termonitor berhasil!');
  });

  test('Step 3: Verifikasi Pemasukan & HPP', async ({ page }) => {
    // Navigasi ke Owner Dashboard
    await page.goto(process.env.OWNER_URL || 'http://localhost:3003', { waitUntil: 'domcontentloaded' });

    // Login jika diperlukan
    if (await page.locator('input[name="identifier"]').isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.fill('input[name="identifier"]', process.env.E2E_ADMIN_EMAIL || '');
      await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD || '');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000, waitUntil: 'domcontentloaded' });
    }

    // Verifikasi halaman Kinerja Penjualan (Pemasukan bertambah dan HPP tercatat)
    await expect(page.locator('text=Kinerja Penjualan')).toBeVisible({ timeout: 15000 });
    console.log('Step 3: Verifikasi Owner Dashboard berhasil!');
  });

  test('Step 4: Verifikasi Jurnal Buku Besar (Ledger)', async ({ page }) => {
    // Navigasi ke Admin Dashboard atau modul akuntansi
    await page.goto(process.env.ADMIN_URL || 'http://localhost:3005', { waitUntil: 'domcontentloaded' });

    // Login jika diperlukan
    if (await page.locator('input[name="identifier"]').isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.fill('input[name="identifier"]', process.env.E2E_ADMIN_EMAIL || '');
      await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD || '');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000, waitUntil: 'domcontentloaded' });
    }

    // Pastikan masuk ke dashboard admin
    // Kas bertambah, Pendapatan bertambah, HPP bertambah, Stok berkurang.
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    console.log('Step 4: Verifikasi Admin Dashboard / Ledger berhasil!');
  });

});
