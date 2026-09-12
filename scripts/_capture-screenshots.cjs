const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:5173";
const OUT_DIR = process.argv[3] || path.join(__dirname, "..", "docs", "screenshots");
const MANIFEST = require(path.resolve(process.argv[4] || path.join(__dirname, "_screenshot-manifest.json")));
const ONLY = process.argv[5] ? process.argv[5].split(",") : null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);

  // Establish demo mode once — the ?demo=1 handling lives on Home (/), which
  // calls enterDemo() then client-navigates to /dashboard. sessionStorage
  // persists across goto() in the same tab/context, so every later
  // navigation rehydrates as the demo org without repeating this.
  await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page
    .locator('[aria-label="Dismiss critical alert"]')
    .click({ timeout: 3000 })
    .catch(() => {});

  const results = [];
  for (const item of MANIFEST) {
    if (ONLY && !ONLY.includes(item.name)) continue;
    const outPath = path.join(OUT_DIR, item.file);
    try {
      await page.goto(`${BASE}${item.path}`, { waitUntil: "networkidle", timeout: 20000 });
      if (item.waitText) {
        await page.waitForSelector(`text=${item.waitText}`, { timeout: 10000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
      // Demo mode scripts a full-screen "critical alert" takeover on a timer,
      // independent of which page is open — clear it before it ruins the shot.
      const blocker = page.locator('[aria-label="Dismiss critical alert"]');
      if (await blocker.count()) {
        await blocker.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      if (item.scrollToText) {
        const loc = page.locator(`text=${item.scrollToText}`).first();
        if (await loc.count()) await loc.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
      }
      if (Array.isArray(item.click)) {
        for (const sel of item.click) {
          const loc = page.locator(sel).first();
          if (await loc.count()) {
            await loc.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
          } else {
            results.push({ name: item.name, warn: `click target not found: ${sel}` });
          }
        }
      }
      if (await blocker.count()) {
        await blocker.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await page.screenshot({ path: outPath });
      const errors = [];
      page.removeAllListeners("pageerror");
      results.push({ name: item.name, ok: true, file: item.file });
    } catch (e) {
      results.push({ name: item.name, ok: false, error: String(e && e.message || e) });
    }
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
