import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const outDir = 'C:\\Users\\Digital Marketing\\.gemini\\antigravity\\brain\\9812d4ab-4ad1-426b-a268-1d4551b55718';

  const routes = [
    { url: '/login', name: 'login_page.png' },
    { url: '/kiosk', name: 'kiosk_face.png' },
    { url: '/dashboard', name: 'dashboard_main.png' },
    { url: '/dashboard/cuti', name: 'leave_request.png' },
    { url: '/dashboard/kasbon', name: 'cash_advance.png' },
    { url: '/dashboard/rekap', name: 'recap_report.png' }
  ];

  for (const route of routes) {
    console.log(`Taking screenshot of ${route.url}...`);
    try {
      await page.goto(`${baseUrl}${route.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      // wait a bit for animations
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, route.name) });
      console.log(`Saved ${route.name}`);
    } catch (e) {
      console.error(`Failed to snapshot ${route.url}: ${e}`);
    }
  }

  await browser.close();
})();
