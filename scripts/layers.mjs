/** Measures mean luminance with individual atmosphere layers disabled. */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});

const CASES = {
  baseline: "",
  "no grade": "document.querySelector('.atmo-grade')?.remove()",
  "no vignette": "document.querySelector('.atmo-vignette')?.remove()",
  "no grain": "document.querySelector('.atmo-grain')?.remove()",
  "no wall noise": "document.querySelectorAll('.room-wall').forEach(w=>w.style.setProperty('--kill','1'));const s=document.createElement('style');s.textContent='.room-wall::after{display:none}';document.head.appendChild(s)",
  "no atmo at all": "document.querySelectorAll('.atmo').forEach(e=>e.remove())",
};

try {
  for (const [label, script] of Object.entries(CASES)) {
    const page = await browser.newPage();
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await page.mouse.move(740, 380);
    await new Promise((r) => setTimeout(r, 2200));
    if (script) await page.evaluate(script);
    await new Promise((r) => setTimeout(r, 350));

    const shot = await page.screenshot({ encoding: "base64" });
    const mean = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let sum = 0, n = 0, max = 0;
      for (let i = 0; i < data.length; i += 4 * 11) {
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        sum += lum;
        max = Math.max(max, lum);
        n += 1;
      }
      return { mean: Math.round(sum / n), max: Math.round(max) };
    }, shot);

    console.log(`${label.padEnd(18)} mean ${String(mean.mean).padStart(3)}   max ${mean.max}`);
    await page.close();
  }
} finally {
  await browser.close();
}
