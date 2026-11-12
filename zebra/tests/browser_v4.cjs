const { chromium } = require("/tmp/node_modules/playwright");
const fs = require("fs"),
  assert = require("assert");
const html = fs.readFileSync(
  require("path").join(__dirname, "../../zebra_puzzle.html"),
  "utf8",
);
const out = "/tmp/zebra-v4/shots";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const report = [];
  for (const [device, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.route("https://audit.local/**", (r) =>
      r.fulfill({ status: 200, contentType: "text/html", body: html }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto("https://audit.local/zebra");
    const shot = async (name) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${out}/${device}-${name}.png`, fullPage: true });
      const dims = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      report.push({ device, name, ...dims });
      assert(dims.scrollWidth <= dims.width + 1, `overflow ${device}/${name}`);
    };
    await shot("01-home");
    await page.locator("#startBtn").click();
    await shot("02-game");
    await page.locator("#grid .cell").first().click();
    await shot("03-picker");
    await page.locator("#pickerOpts .opt").first().click();
    // fill some cells to see chips + clue states
    await page.evaluate(() => {
      const p = ZEBRA.S.cur;
      const cats = Object.keys(p.categories);
      cats.forEach((c, r) => {
        for (let i = 0; i < Math.min(2, 5 - r); i++)
          ZEBRA.S.assign[c][i] = p.solution[c][i];
      });
      ZEBRA.S.assign[cats[0]][2] = p.categories[cats[0]].find(
        (v) => !p.solution[cats[0]].includes(v),
      ) || p.categories[cats[0]][0];
      renderGrid();
    });
    await shot("04-filled");
    await page.locator("#hintBtn").click();
    await shot("05-hint");
    await page.evaluate(() => {
      const p = ZEBRA.S.cur;
      Object.keys(p.solution).forEach((c) => p.solution[c].forEach((v, i) => (ZEBRA.S.assign[c][i] = v)));
      renderGrid();
      autoCheck();
    });
    await shot("06-solved");
    assert.deepEqual(errors, []);
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify({ shots: report.length, report }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
