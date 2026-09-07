/**
 * Visual iteration harness.
 *
 * Drives the locally installed Chrome to capture the scene at specific world
 * states, so art direction can be reviewed as images rather than guessed at.
 * Art direction is the highest-risk part of this product; being able to look at
 * it on every change is worth a dev dependency.
 *
 *   node scripts/shoot.mjs [name] [--w 1440] [--h 900] [--wait 2500] [--act <script>]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const name = args[0] && !args[0].startsWith("--") ? args[0] : "shot";
const width = Number(flag("w", 1440));
const height = Number(flag("h", 900));
const wait = Number(flag("wait", 2600));
const act = flag("act", null);
const url = flag("url", "http://localhost:3000/");

mkdirSync(".tmp/shots", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "--force-device-scale-factor=2",
    `--window-size=${width},${height}`,
  ],
  defaultViewport: { width, height, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  // Park the pointer mid-screen so parallax and pointer-lit materials settle in
  // a representative state rather than at their defaults.
  await page.mouse.move(width * 0.52, height * 0.42);
  await new Promise((r) => setTimeout(r, wait));

  if (act) {
    // `act` arrives as the source of an arrow function, so it has to be
    // invoked. Evaluating the bare expression only constructs the function.
    await page.evaluate(`(${act})()`);
    await new Promise((r) => setTimeout(r, Number(flag("settle", 1800))));
  }

  const path = `.tmp/shots/${name}.png`;
  await page.screenshot({ path });
  console.log(`wrote ${path} (${width}x${height})`);
  if (problems.length) {
    console.log("\nconsole output:");
    for (const p of [...new Set(problems)].slice(0, 15)) console.log("  " + p);
  } else {
    console.log("no console errors");
  }
} finally {
  await browser.close();
}
