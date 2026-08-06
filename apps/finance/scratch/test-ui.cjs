const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('sales_daily_spv')) {
      console.log('--- PostgREST Response (sales_daily_spv) ---');
      console.log('URL:', response.url());
      console.log('Status:', response.status());
      try {
        const body = await response.json();
        console.log('Body length:', Array.isArray(body) ? body.length : 'not array');
      } catch (e) {
        console.log('Body: <could not parse>');
      }
    }
    if (response.url().includes('outlets')) {
      console.log('--- PostgREST Response (outlets) ---');
      console.log('Status:', response.status());
      try {
        const body = await response.json();
        console.log('Outlets length:', Array.isArray(body) ? body.length : 'not array');
      } catch (e) {
      }
    }
  });

  console.log('Navigating to http://localhost:3020');
  await page.goto('http://localhost:3020', { waitUntil: 'networkidle' });
  
  // Wait a bit just in case React Query is doing something
  await page.waitForTimeout(3000);
  
  const content = await page.content();
  if (content.includes('Tidak ada data penjualan')) {
    console.log('UI SHOWS EMPTY STATE!');
  } else if (content.includes('Gagal memuat')) {
    console.log('UI SHOWS ERROR STATE!');
  } else {
    console.log('UI SHOWS DATA!');
  }
  
  console.log('Page title:', await page.title());

  await browser.close();
}
run();
