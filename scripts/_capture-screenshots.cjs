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

  // Establish demo mode — the ?demo=1 handling lives on Home (/), which calls
  // enterDemo() then client-navigates to /dashboard. sessionStorage persists
  // across goto() in the same tab/context, so this only needs to run once...
  // in principle. In practice, a handful of pages fire a real (non-demo-gated)
  // API call that 401s, and api.ts reacts with a hard `window.location.assign
  // ("/login")` — an async redirect that can land *after* we've already
  // moved on to the next item, hijacking it. ensureDemo() re-bootstraps and
  // is called defensively whenever we detect we've been bounced to /login.
  const ensureDemo = async () => {
    await page.goto(`${BASE}/?demo=1`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page
      .locator('[aria-label="Dismiss critical alert"]')
      .click({ timeout: 3000 })
      .catch(() => {});
  };

  await ensureDemo();

  const dismissBlocker = async () => {
    const blocker = page.locator('[aria-label="Dismiss critical alert"]');
    if (await blocker.count()) {
      await blocker.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  };

  const results = [];
  for (const item of MANIFEST) {
    if (ONLY && !ONLY.includes(item.name)) continue;
    const outPath = path.join(OUT_DIR, item.file);
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        // Bounced to login (a delayed 401-triggered redirect from a prior
        // item, or this one) — re-bootstrap demo mode and retry once.
        if (/\/login(\?|$)/.test(page.url()) && !/\/login/.test(item.path) && attempt < 3) {
          await ensureDemo();
          continue;
        }
        if (item.waitText) {
          await page.waitForSelector(`text=${item.waitText}`, { timeout: 12000 }).catch(() => {});
        }
        await page.waitForTimeout(700);
        await dismissBlocker();
        if (/\/login(\?|$)/.test(page.url()) && !/\/login/.test(item.path) && attempt < 3) {
          await ensureDemo();
          continue;
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
        await dismissBlocker();
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        await page.screenshot({ path: outPath });
        results.push({ name: item.name, ok: true, file: item.file, attempt });
      } catch (e) {
        results.push({ name: item.name, ok: false, error: String((e && e.message) || e) });
      }
      break;
    }
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
