/** Dumps scene-graph diagnostics from the running app. */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text());
  });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2500));

  const info = await page.evaluate(() => {
    const out = {};
    const stage = document.querySelector(".world-stage");
    const camera = document.querySelector(".world-camera");
    const root = document.querySelector(".world-root");
    const wall = document.querySelector(".room-wall");

    const describe = (el, label) => {
      if (!el) return { [label]: "MISSING" };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        [label]: {
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
          transform: cs.transform.slice(0, 120),
          perspective: cs.perspective,
          transformStyle: cs.transformStyle,
          background: cs.backgroundColor,
          display: cs.display,
          children: el.children.length,
        },
      };
    };

    Object.assign(out, describe(stage, "stage"));
    Object.assign(out, describe(camera, "camera"));
    Object.assign(out, describe(root, "root"));
    Object.assign(out, describe(wall, "wall"));

    out.counts = {
      worldNodes: document.querySelectorAll(".world-node").length,
      walls: document.querySelectorAll(".room-wall").length,
      albums: document.querySelectorAll(".zone-hotspot").length,
    };

    const themed = document.querySelector("main > div");
    if (themed) {
      const cs = getComputedStyle(themed);
      out.theme = {
        wall: cs.getPropertyValue("--room-wall"),
        light: cs.getPropertyValue("--room-light-color"),
        litAngle: cs.getPropertyValue("--lit-angle"),
      };
    }
    out.bodyHTMLLength = document.body.innerHTML.length;
    return out;
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
