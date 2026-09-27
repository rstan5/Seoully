import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE_URL = process.env.SEOULLY_QA_BASE_URL ?? "http://localhost:3000";
const HEART_TIMEOUT = 45_000;

function loadLocalEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export async function launchQaBrowser() {
  return puppeteer.launch({
    executablePath: process.env.SEOULLY_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
}

export async function login(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2" });
  await clickIfPresent(page, "button", /I already have a name here/);
  await page.waitForSelector('input[type="email"]', { visible: true, timeout: HEART_TIMEOUT });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await clickWhenReady(page, "button", /^(Sign in|로그인)$/);
  await waitForHeartIdle(page);
  await page.waitForFunction(() => !document.body.innerText.includes("Sign in to your Seoully account"), { timeout: HEART_TIMEOUT });
}

/** Waits for the real heart transition overlay to finish before interacting. */
export async function waitForHeartIdle(page) {
  await page.waitForFunction(
    () => !document.querySelector(".heart-scene") || !document.querySelector(".heart-scene:not([hidden])"),
    { timeout: HEART_TIMEOUT },
  );
}

/** Click a control only after it is visible, enabled, and no heart scene blocks it. */
export async function clickWhenReady(page, selector, text) {
  await waitForHeartIdle(page);
  await page.waitForFunction(
    (sel, source, flags) => [...document.querySelectorAll(sel)].some((node) => !node.disabled && new RegExp(source, flags).test(node.textContent?.trim() ?? "")),
    { timeout: HEART_TIMEOUT },
    selector,
    text.source,
    text.flags,
  );
  await page.waitForFunction(
    (sel, source, flags) => [...document.querySelectorAll(sel)].some((node) => {
      const element = node;
      return !element.disabled && new RegExp(source, flags).test(element.textContent?.trim() ?? "");
    }),
    { timeout: HEART_TIMEOUT },
    selector,
    text.source,
    text.flags,
  );
  await page.evaluate((sel, source, flags) => {
    const node = [...document.querySelectorAll(sel)].find((candidate) => !candidate.disabled && new RegExp(source, flags).test(candidate.textContent?.trim() ?? ""));
    node?.click();
  }, selector, text.source, text.flags);
}

async function clickIfPresent(page, selector, text) {
  const found = await page.evaluate((sel, source, flags) => [...document.querySelectorAll(sel)].some((node) => new RegExp(source, flags).test(node.textContent?.trim() ?? "")), selector, text.source, text.flags);
  if (found) await clickWhenReady(page, selector, text);
}

export async function finishOnboardingToCollect(page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("Add your first collectible") || text.includes("첫 번째 컬렉터블")) return;
    if (text.includes("Show us who you are")) {
      await clickWhenReady(page, "button", /^(Skip for now|지금은 건너뛰기)$/);
      await page.waitForFunction(() => document.body.innerText.includes("Who’s your group?") || document.body.innerText.includes("어떤 그룹"), { timeout: HEART_TIMEOUT });
    } else if (text.includes("Who’s your group?") || text.includes("어떤 그룹")) {
      await clickWhenReady(page, "button", /^(Skip for now|지금은 건너뛰기)$/);
      await page.waitForFunction(() => document.body.innerText.includes("What do you collect?") || document.body.innerText.includes("무엇을 수집"), { timeout: HEART_TIMEOUT });
    } else if (text.includes("What do you collect?") || text.includes("무엇을 수집")) {
      await clickWhenReady(page, "button", /^(Continue|계속)$/);
      await page.waitForFunction(() => document.body.innerText.includes("Add your first collectible") || document.body.innerText.includes("첫 번째 컬렉터블"), { timeout: HEART_TIMEOUT });
    }
    else break;
  }
  await page.waitForFunction(() => document.body.innerText.includes("Add your first collectible") || document.body.innerText.includes("첫 번째 컬렉터블"), { timeout: HEART_TIMEOUT });
}

export async function openManualCollectible(page, name = "QA Seoully photocard") {
  await finishOnboardingToCollect(page);
  await clickWhenReady(page, "button", /It isn’t listed|설명/);
  await page.waitForSelector("#catalog-name", { visible: true, timeout: HEART_TIMEOUT });
  await page.type("#catalog-name", name);
  await clickWhenReady(page, "button", /^(Review|검토|Continue|계속)$/);
  await page.waitForFunction(() => document.body.innerText.includes("Confirm") || document.body.innerText.includes("확인"), { timeout: HEART_TIMEOUT });
}

export function qaCredentials() {
  const env = loadLocalEnv();
  return {
    A: { email: env.SEOULLY_QA_A_EMAIL, password: env.SEOULLY_QA_A_PASSWORD },
    B: { email: env.SEOULLY_QA_B_EMAIL, password: env.SEOULLY_QA_B_PASSWORD },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const credentials = qaCredentials();
  const browser = await launchQaBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await login(page, credentials.A.email, credentials.A.password);
  await finishOnboardingToCollect(page);
  await openManualCollectible(page);
  await clickWhenReady(page, "button", /^(Confirm|확인)$/);
  await page.waitForFunction(() => document.body.innerText.includes("Add to collection") || document.body.innerText.includes("컬렉션에 추가"), { timeout: HEART_TIMEOUT });
  await clickWhenReady(page, "button", /^(Add to collection|컬렉션에 추가)$/);
  await page.waitForFunction(() => !document.body.innerText.includes("Add to collection") && !document.body.innerText.includes("컬렉션에 추가"), { timeout: HEART_TIMEOUT });
  const postConfirmText = await page.evaluate(() => document.body.innerText);
  const first = await page.evaluate(async () => await (await fetch("/api/holdings")).text());
  await page.reload({ waitUntil: "networkidle2" });
  const afterRefresh = await page.evaluate(async () => await (await fetch("/api/holdings")).text());
  console.log(`QA onboarding harness completed manual collectible path. Before: ${first}. After refresh: ${afterRefresh}. Screen: ${postConfirmText.slice(0, 220).replace(/\n/g, " | ")}`);
  await browser.close();
  process.exit(0);
}
