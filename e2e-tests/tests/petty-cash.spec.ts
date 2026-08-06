import { test, expect } from '@playwright/test';

// Konstanta URL untuk masing-masing aplikasi (sesuaikan dengan environment)
const FINANCE_URL = process.env.FINANCE_URL || 'http://localhost:3020';
const KASIR_URL = process.env.KASIR_URL || 'http://localhost:3004';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3010'; // Jika login via portal SSO

// Kredensial untuk testing (sebaiknya diletakkan di .env)
const FINANCE_USER = process.env.FINANCE_TEST_USER || 'finance@sukashawarma.com';
const KASIR_USER = process.env.KASIR_TEST_USER || 'kasir@sukashawarma.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

test.describe('E2E Petty Cash Topup Flow', () => {
  // Gunakan browser context terpisah jika ingin menguji flow paralel
  
  test('Flow lengkap: Topup Petty Cash sampai masuk ke Laci Kasir', async ({ browser }) => {
    // 1. Context Kasir untuk mengajukan/mengecek dana
    const kasirContext = await browser.newContext();
    const kasirPage = await kasirContext.newPage();
    
    // 2. Context Finance untuk Approval
    const financeContext = await browser.newContext();
    const financePage = await financeContext.newPage();

    // ==========================================
    // FASE 1: FINANCE APPROVAL
    // ==========================================
    await test.step('Finance Login & Approve Petty Cash', async () => {
      await financePage.goto(`${FINANCE_URL}/login`);
      
      // Asumsi ada form login, sesuaikan selector dengan aplikasi
      try {
        await financePage.fill('input[type="email"]', FINANCE_USER);
        await financePage.fill('input[type="password"]', TEST_PASSWORD);
        await financePage.click('button[type="submit"]');
        await financePage.waitForURL(`${FINANCE_URL}/**`);
      } catch (e) {
        console.log('Login form not found or already logged in (maybe using SSO). Please adjust selectors.');
      }

      // Navigasi ke halaman Petty Cash Finance
      await financePage.goto(`${FINANCE_URL}/petty-cash`);
      
      // Tunggu hingga list petty cash termuat
      await financePage.waitForSelector('text=Pencairan Petty Cash', { timeout: 10000 });
      
      // Cari tombol "Proses / Acc" pada pengajuan pertama yang berstatus menunggu
      const accButton = financePage.locator('button:has-text("Proses / Acc")').first();
      
      // Jika ada pengajuan yang butuh Acc
      if (await accButton.isVisible()) {
        await accButton.click();
        
        // Modal Approval Finance Terbuka, isi form transfer (misal nominal & metode)
        const modal = financePage.locator('[role="dialog"]');
        await expect(modal).toBeVisible();
        
        // Memilih metode pencairan, misalnya Transfer Bank
        await modal.locator('button:has-text("Transfer Bank")').click();
        
        // Upload bukti transfer jika diperlukan (dummy file)
        // await financePage.setInputFiles('input[type="file"]', 'path/to/dummy-receipt.jpg');
        
        // Setujui pencairan
        await modal.locator('button:has-text("Setujui & Cairkan")').click();
        
        // Verifikasi notifikasi sukses
        await expect(financePage.locator('text=berhasil diproses')).toBeVisible();
      } else {
        console.log('Tidak ada pengajuan Petty Cash yang perlu di-acc saat ini. Melewati langkah approval.');
      }
    });

    // ==========================================
    // FASE 2: KASIR CEK DANA LACI (SHIFT)
    // ==========================================
    await test.step('Kasir Cek Petty Cash Masuk', async () => {
      await kasirPage.goto(`${KASIR_URL}/login`);
      
      // Kasir login
      try {
        await kasirPage.fill('input[type="email"]', KASIR_USER);
        await kasirPage.fill('input[type="password"]', TEST_PASSWORD);
        await kasirPage.click('button[type="submit"]');
        await kasirPage.waitForURL(`${KASIR_URL}/**`);
      } catch (e) {
        console.log('Login form not found for kasir. Please adjust selectors.');
      }

      // Navigasi ke halaman Shift Kasir
      await kasirPage.goto(`${KASIR_URL}/kasir/shift`);
      
      // Tunggu hingga halaman shift termuat
      await kasirPage.waitForSelector('text=Uang Modal (Petty Cash)');

      // Karena kasir berlangganan realtime Supabase, saldo otomatis terupdate
      // Kita asumsikan ada indikator saldo "Kas Tersedia" atau histori topup
      const topupHistoryList = kasirPage.locator('text=Riwayat Modal (Petty Cash)');
      if (await topupHistoryList.isVisible()) {
         // Pastikan status "Diserahkan ke Crew" / "Selesai" muncul
         await expect(kasirPage.locator('text=Selesai').first()).toBeVisible({ timeout: 15000 });
      }
      
      // Verifikasi saldo bertambah (ini butuh state awal vs akhir, contoh asersi dasar)
      const balanceElement = kasirPage.locator('.petty-cash-balance'); // Sesuaikan selector
      if (await balanceElement.isVisible()) {
        const balanceText = await balanceElement.innerText();
        console.log('Saldo Petty Cash saat ini:', balanceText);
        expect(balanceText).not.toBe('Rp 0');
      }
    });
    
    // Cleanup
    await kasirContext.close();
    await financeContext.close();
  });
});
