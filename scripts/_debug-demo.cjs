const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => console.log("CONSOLE:", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

  await page.goto("http://localhost:5173/?demo=1", { waitUntil: "networkidle" });
  console.log("URL after goto /?demo=1:", page.url());
  await page.waitForTimeout(1500);
  console.log("URL after wait:", page.url());
  const flag = await page.evaluate(() => sessionStorage.getItem("phantix_demo") || sessionStorage.getItem("demo") || JSON.stringify(Object.entries(sessionStorage)));
  console.log("sessionStorage dump:", flag);

  await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
  console.log("URL after goto /dashboard:", page.url());
  await page.screenshot({ path: "docs/screenshots/_debug1.png" });

  await browser.close();
})();
