/* eslint-disable @typescript-eslint/no-require-imports */

const { chromium } = require(`${process.env.TEMP}\\rokulan-playwright\\node_modules\\playwright-core`);
const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(outputDir, { recursive: true });

const browserMessages = [];
const failures = [];
const layoutAudits = [];

async function newPage(browser, width, height, syntheticConnected = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (message) => {
    browserMessages.push({ width, height, type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    browserMessages.push({ width, height, type: 'pageerror', text: error.message });
  });
  page.on('requestfailed', (request) => {
    failures.push({ width, height, url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
  });
  if (syntheticConnected) {
    await page.route('http://127.0.0.1:8787/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ip: '192.168.1.25',
            friendlyName: 'Living Room Demo',
            modelName: 'Synthetic Roku',
            modelNumber: 'DEMO-001',
          }),
        });
      } else {
        await route.fulfill({ status: 204, body: '' });
      }
    });
  }
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.getByText('No saved devices yet.').waitFor();
  return { context, page };
}

async function snap(page, filename, fullPage = false) {
  await page.waitForTimeout(250);
  layoutAudits.push(await page.evaluate((name) => ({
    filename: name,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }), filename));
  await page.screenshot({ path: path.join(outputDir, filename), fullPage });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  try {
    for (const [width, height, filename] of [
      [375, 812, 'rokulan-mobile-375-disconnected.png'],
      [390, 844, 'rokulan-mobile-390-ip-entry.png'],
      [430, 932, 'rokulan-mobile-430-disconnected.png'],
      [768, 1024, 'rokulan-tablet-768-disconnected.png'],
      [1440, 900, 'rokulan-desktop-1440-disconnected.png'],
    ]) {
      const { context, page } = await newPage(browser, width, height);
      if (width === 390) await page.getByLabel('Roku IP address').fill('192.168.1.25');
      await snap(page, filename);
      if (width === 390) await snap(page, 'rokulan-mobile-390-full-page.png', true);
      if (width === 1440) await snap(page, 'rokulan-desktop-1440-full-page.png', true);
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, 430, 932);
      await page.getByLabel('Roku IP address').fill('192.168.1.25');
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByText('RokuLAN could not reach the local bridge. Start the bridge, then try again.').waitFor();
      await snap(page, 'rokulan-bridge-unavailable.png', true);
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, 375, 812);
      await page.getByLabel('Roku IP address').fill('999.999.1.1');
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.locator('p[role="alert"]').waitFor();
      await snap(page, 'rokulan-invalid-ip.png', true);
      await context.close();
    }

    for (const [width, height, filename] of [
      [390, 844, 'rokulan-mobile-connected-synthetic.png'],
      [1440, 900, 'rokulan-desktop-1440-connected-synthetic.png'],
    ]) {
      const { context, page } = await newPage(browser, width, height, true);
      await page.getByLabel('Roku IP address').fill('192.168.1.25');
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByText('Remote online').waitFor();
      await snap(page, filename, width === 390);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outputDir, 'browser-evidence.json'), JSON.stringify({ browserMessages, requestFailures: failures, layoutAudits }, null, 2));
})();
