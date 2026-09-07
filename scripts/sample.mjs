/** Samples pixel colors from the live page so tonal range can be measured, not eyeballed. */
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
  await page.mouse.move(740, 380);
  await new Promise((r) => setTimeout(r, 2600));

  const shot = await page.screenshot({ encoding: "base64" });

  const stats = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    let min = 255, max = 0, sum = 0, n = 0;
    const hist = new Array(8).fill(0);
    for (let i = 0; i < data.length; i += 4 * 7) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      min = Math.min(min, lum);
      max = Math.max(max, lum);
      sum += lum;
      n += 1;
      hist[Math.min(7, Math.floor(lum / 32))] += 1;
    }

    const at = (x, y) => {
      const px = Math.round(x * c.width);
      const py = Math.round(y * c.height);
      const i = (py * c.width + px) * 4;
      return `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
    };

    return {
      luminance: { min: Math.round(min), max: Math.round(max), mean: Math.round(sum / n) },
      histogram: hist.map((v) => Math.round((v / n) * 100) + "%"),
      samples: {
        topLeft: at(0.12, 0.12),
        center: at(0.5, 0.45),
        shelfArea: at(0.28, 0.45),
        deskArea: at(0.5, 0.75),
        rightWall: at(0.85, 0.35),
        bottom: at(0.5, 0.95),
      },
    };
  }, shot);

  console.log(JSON.stringify(stats, null, 2));
} finally {
  await browser.close();
}
