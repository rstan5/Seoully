/** Samples the back wall directly to find where the light is going. */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2400));
  await page.evaluate("document.querySelectorAll('.atmo').forEach(e=>e.remove())");
  await new Promise((r) => setTimeout(r, 300));

  const shot = await page.screenshot({ encoding: "base64" });

  const out = await page.evaluate(async (b64) => {
    const wall = document.querySelector(".room-wall");
    const cs = getComputedStyle(wall);
    const rect = wall.getBoundingClientRect();

    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const dpr = img.width / window.innerWidth;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    const at = (vx, vy) => {
      const i = (Math.round(vy * dpr) * c.width + Math.round(vx * dpr)) * 4;
      return `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
    };

    return {
      resolvedWallVar: cs.getPropertyValue("--room-wall"),
      computedBg: cs.backgroundColor,
      bgImageLayers: cs.backgroundImage.split(/,(?![^(]*\))/).length,
      opacity: cs.opacity,
      filter: cs.filter,
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      // Points strictly inside the wall's screen rect.
      wallSamples: {
        upperLeft: at(rect.x + rect.width * 0.25, rect.y + rect.height * 0.2),
        lightCore: at(rect.x + rect.width * 0.36, rect.y + rect.height * 0.2),
        middle: at(rect.x + rect.width * 0.5, rect.y + rect.height * 0.4),
        upperRight: at(rect.x + rect.width * 0.8, rect.y + rect.height * 0.2),
      },
      outsideWall: at(20, 20),
    };
  }, shot);

  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}
