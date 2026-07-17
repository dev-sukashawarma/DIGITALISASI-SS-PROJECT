const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('Starting Playwright...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    const outputDir = path.join(__dirname, 'public', 'guides');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    async function annotate(page, annotations) {
        await page.evaluate((anns) => {
            let container = document.getElementById('annotation-layer');
            if (container) {
                container.remove();
            }
            container = document.createElement('div');
            container.id = 'annotation-layer';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '999999';
            document.body.appendChild(container);
            
            anns.forEach(a => {
                if (a.type === 'circle') {
                    const circle = document.createElement('div');
                    circle.style.position = 'absolute';
                    circle.style.left = a.x + 'px';
                    circle.style.top = a.y + 'px';
                    circle.style.width = a.w + 'px';
                    circle.style.height = a.h + 'px';
                    circle.style.border = '4px solid red';
                    circle.style.borderRadius = '50%';
                    circle.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                    
                    const label = document.createElement('div');
                    label.style.position = 'absolute';
                    label.style.top = '-30px';
                    label.style.left = '0';
                    label.style.backgroundColor = 'red';
                    label.style.color = 'white';
                    label.style.padding = '4px 8px';
                    label.style.borderRadius = '4px';
                    label.style.fontWeight = 'bold';
                    label.style.fontSize = '14px';
                    label.innerText = a.text;
                    
                    circle.appendChild(label);
                    container.appendChild(circle);
                }
            });
        }, annotations);
    }

    try {
        console.log('Navigating to Kiosk Home...');
        await page.goto('https://pos.sukashawarma.com/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000); 
        
        console.log('At Kiosk Home, annotating and taking screenshot...');
        await annotate(page, [
            { type: 'circle', x: 500, y: 350, w: 250, h: 100, text: 'Masuk Portal' }
        ]);
        await page.screenshot({ path: path.join(outputDir, '1_kiosk_home.png') });
        console.log('Saved 1_kiosk_home.png');

        console.log('Navigating to Login...');
        // We go directly to portal login, but with a returnTo param if possible.
        // Actually, going to pos.sukashawarma.com/login redirects us to portal login.
        await page.goto('https://pos.sukashawarma.com/login', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);

        console.log('At Login, taking screenshot...');
        await page.screenshot({ path: path.join(outputDir, '2_login.png') });
        console.log('Saved 2_login.png');
        
        console.log('Logging in...');
        // Wait for the email input to be visible
        await page.waitForSelector('input[name="email"], input[type="email"], #identifier', { timeout: 10000 });
        
        // Fill form
        const emailInput = await page.$('input[name="email"], input[type="email"], #identifier');
        if (emailInput) await emailInput.fill('kasir_tes@ss.com');
        
        const pwdInput = await page.$('input[name="password"], input[type="password"], #password');
        if (pwdInput) await pwdInput.fill('password123');

        // Press enter to submit
        if (pwdInput) {
            await pwdInput.press('Enter');
        } else {
            // fallback
            const btn = await page.$('button[type="submit"]');
            if (btn) await btn.click({ force: true });
        }
        
        console.log('Waiting for Dashboard...');
        try {
            await page.waitForURL('**/kasir/**', { timeout: 15000 });
            await page.waitForLoadState('networkidle');
        } catch (e) {
            console.log('Failed to redirect to kasir. We might be on portal dashboard. Navigating manually...');
            await page.goto('https://pos.sukashawarma.com/kasir/pos', { waitUntil: 'networkidle' });
        }

        await page.waitForTimeout(3000);

        // Click anything on screen to hide any tooltips/modals if needed
        await page.mouse.click(0, 0);
        await page.waitForTimeout(1000);

        console.log('At dashboard, annotating and taking screenshot...');
        await annotate(page, [
            { type: 'circle', x: 20, y: 150, w: 350, h: 400, text: 'Menunggu (Pending)' },
            { type: 'circle', x: 420, y: 150, w: 350, h: 400, text: 'Diproses (Preparing)' },
            { type: 'circle', x: 820, y: 150, w: 350, h: 400, text: 'Selesai (Completed)' }
        ]);
        await page.screenshot({ path: path.join(outputDir, '3_dashboard.png') });
        console.log('Saved 3_dashboard.png');

        console.log('Navigating to Menu Management...');
        await page.goto('https://pos.sukashawarma.com/kasir/menu', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);
        await annotate(page, [
            { type: 'circle', x: 800, y: 200, w: 150, h: 80, text: 'Ubah Ketersediaan (Tersedia/Habis)' }
        ]);
        await page.screenshot({ path: path.join(outputDir, '4_menu.png') });
        console.log('Saved 4_menu.png');

    } catch (e) {
        console.error('Error during screenshots:', e);
    }

    await browser.close();
    console.log('Done!');
}

main();
