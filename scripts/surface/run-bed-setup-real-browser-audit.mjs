import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const targetUrl = process.env.WORKOS_BED_SETUP_URL || `${baseUrl}/?view=operationPanel&lang=zh-CN&device=mobile&workspace=W-STAY-RESOURCE-20260604113929-d8be2bd7995e41c5a2cee7a559e1fed4&workItem=wi-b3c851d7d6b4248cea09c648d66a149b0f0f1bfc2af041568bfedc13048fe590&card=bedSetup`;
const runId = process.env.OAM_BED_SETUP_BROWSER_RUN_ID || `bed-setup-layout-${timestamp()}`;
const artifactRoot = path.join(root, "artifacts", "oam-cab", "dormitory-real-browser-hardening-20260604-current", "bed-setup-real-browser", runId);
const screenshotRoot = path.join(artifactRoot, "screenshots");
const reportPath = path.join(artifactRoot, "bed-setup-real-browser-report.json");
const screenshotIndexPath = path.join(artifactRoot, "screenshot-index.json");

fs.mkdirSync(screenshotRoot, { recursive: true });

const report = {
  version: "bed-setup.real-browser.audit.v1",
  status: "running",
  runId,
  generatedAtUtc: new Date().toISOString(),
  browserMode: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1" ? "playwright-chromium-headless" : "playwright-chromium-visible",
  mockPolicy: "real browser page navigation, clicks, selects, and screenshots only; no backend simulation and no DOM stubbing",
  endpoints: { baseUrl, apiUrl, targetUrl },
  screenshots: [],
  assertions: [],
  findings: []
};

try {
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 60)
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 400, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();

    await login(page);
    await openTarget(page);
    await capture(page, "01-bed-setup-initial", "床位配置页初始状态");

    await clickIfVisible(page, '[data-operation-field="bedType"]');
    await page.locator('[data-operation-field="bedType"]').selectOption("bunk_pair");
    await page.waitForTimeout(120);
    await capture(page, "02-bed-generation-mode-selected", "床铺生成方式点击后生成两上两下");

    await clickIfVisible(page, "[data-save-draft]");
    await page.waitForTimeout(250);
    await capture(page, "03-save-draft-clicked", "保存草稿后仍保持统一床位配置页");

    const domState = await readBedSetupState(page);
    addAssertion("bed_setup.room_readonly", domState.roomIdHidden && !domState.roomSearchSelectVisible, "所属房间必须从房间配置只读带入，不再可搜索选择。", domState);
    addAssertion("bed_setup.bed_count_readonly", domState.bedCountHidden && !domState.bedCountEditableVisible, "床位数必须从房间配置只读带入，不再重复填写。", domState);
    addAssertion("bed_setup.no_context_badge", !domState.visibleText.includes("已从本案带入"), "只读带入字段不得显示多余的“已从本案带入”标签。", domState);
    addAssertion("bed_setup.help_copy", domState.visibleText.includes("来自房间配置，不需要重复填写。"), "只读带入字段必须保留轻量说明。", domState);
    addAssertion("bed_setup.no_bed_label_textarea", !domState.bedLabelsTextareaVisible, "床位标签不得继续作为大文本框让用户手工维护。", domState);
    addAssertion("bed_setup.generation_mode_label", domState.visibleText.includes("床铺生成方式") && domState.visibleText.includes("将生成的床位"), "床位配置页必须使用用户能看懂的床铺生成方式和将生成的床位表达。", domState);
    addAssertion("bed_setup.layout_template", domState.bedTypeValue === "bunk_pair", "床铺生成方式默认必须是上下铺：两上两下。", domState);
    addAssertion("bed_setup.four_bed_two_up_two_down", JSON.stringify(domState.bedLayoutTypes) === JSON.stringify(["upper", "lower", "upper", "lower"]), "四人间上下铺：两上两下必须生成两个上铺和两个下铺。", domState);
    addAssertion("bed_setup.submit_check_dependency_aligned", domState.visibleText.includes("可以提交") && domState.visibleText.includes("查看检查详情") && !domState.systemCheckDetailsOpen && domState.systemCheckDetailsText.includes("前步带入") && domState.systemCheckDetailsText.includes("系统生成") && domState.systemCheckDetailsText.includes("需要操作") && !domState.visibleText.includes("还需填写: 所属房间"), "提交前检查默认只显示用户关心的状态，诊断细节收起且不得把带入/派生字段说成用户要填写。", domState);
    addAssertion("bed_setup.initial_status_hidden", !domState.bedStatusVisible, "初始床位状态不得在新建床位步骤显示；后端默认可分配，后续状态变更走房间准备或服务任务。", domState);

    await context.close();
  } finally {
    await browser.close();
  }

  report.status = report.assertions.every((item) => item.status === "passed") && report.findings.length === 0 ? "passed" : "failed";
  writeArtifacts();
  if (report.status !== "passed") {
    console.error(`Bed setup real browser audit: FAIL (${runId})`);
    process.exitCode = 1;
  } else {
    console.log(`Bed setup real browser audit: PASS (${runId})`);
    console.log(rel(reportPath));
  }
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  writeArtifacts();
  console.error("Bed setup real browser audit: FAIL");
  console.error(report.failureReason);
  process.exitCode = 1;
}

async function login(page) {
  await page.goto(`${baseUrl}/?view=login&lang=zh-CN&device=mobile`, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  if (await page.locator("#loginSubmit").count()) {
    await fill(page, "#loginAccount", "admin");
    await fill(page, "#loginPassword", "dev");
    await click(page, "#loginSubmit");
    await page.waitForFunction(() => !document.querySelector("#loginSubmit") || document.body.innerText.includes("工作"), null, { timeout: 15000 });
  }
}

async function openTarget(page) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  await page.waitForSelector('[data-bed-layout-preview]', { timeout: 15000 });
}

async function readBedSetupState(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const bedLayoutRaw = document.querySelector('[data-operation-field="bedLayout"]')?.value || "[]";
    let bedLayout = [];
    try {
      bedLayout = JSON.parse(bedLayoutRaw);
    } catch {
      bedLayout = [];
    }
    return {
      url: window.location.href,
      visibleText: document.body.innerText,
      roomIdHidden: document.querySelector('[data-operation-field="roomId"]')?.type === "hidden",
      roomSearchSelectVisible: Array.from(document.querySelectorAll(".search-select")).some((node) => visible(node) && node.innerText.includes("所属房间")),
      bedCountHidden: document.querySelector('[data-operation-field="bedCount"]')?.type === "hidden",
      bedCountEditableVisible: Array.from(document.querySelectorAll('input[data-operation-field="bedCount"]')).some((node) => node.type !== "hidden" && visible(node) && !node.readOnly),
      bedLabelsTextareaVisible: visible(document.querySelector('textarea[data-operation-field="bedLabels"]')),
      bedLabelsValue: document.querySelector('[data-operation-field="bedLabels"]')?.value || "",
      bedLayoutRaw,
      bedLayoutTypes: bedLayout.map((entry) => entry.type),
      bedTypeValue: document.querySelector('[data-operation-field="bedType"]')?.value || "",
      bedStatusValue: document.querySelector('[data-operation-field="bedStatus"]')?.value || "",
      bedStatusVisible: Array.from(document.querySelectorAll('[data-operation-field="bedStatus"]')).some((node) => visible(node)),
      systemCheckDetailsOpen: Boolean(document.querySelector(".system-check-details")?.open),
      systemCheckDetailsText: document.querySelector(".system-check-details")?.textContent || ""
    };
  });
}

async function capture(page, name, surface) {
  await waitForHydrated(page);
  const fullPath = path.join(screenshotRoot, `${name}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const full = screenshotRecord(fullPath, surface, page.url(), "fullPage");
  report.screenshots.push(full);

  const height = await page.evaluate(() => document.scrollingElement?.scrollHeight || document.body.scrollHeight);
  const viewport = page.viewportSize()?.height || 844;
  const segments = [];
  for (let y = 0, index = 1; y < height; y += Math.max(420, viewport - 80), index++) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
    const segmentPath = path.join(screenshotRoot, `${name}-segment-${String(index).padStart(2, "0")}.png`);
    await page.screenshot({ path: segmentPath, fullPage: false });
    const segment = screenshotRecord(segmentPath, surface, page.url(), `segment-${index}`);
    report.screenshots.push(segment);
    segments.push(segment);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { full, segments };
}

function screenshotRecord(filePath, surface, url, mode) {
  const buffer = fs.readFileSync(filePath);
  return {
    path: rel(filePath),
    surface,
    url,
    mode,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex")
  };
}

function addAssertion(id, passed, message, details = {}) {
  const assertion = { id, status: passed ? "passed" : "failed", message, details };
  report.assertions.push(assertion);
  if (!passed) report.findings.push(assertion);
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count()) await locator.click();
}

async function click(page, selector) {
  await page.locator(selector).first().click({ timeout: 10000 });
}

async function fill(page, selector, value) {
  await page.locator(selector).first().fill(value, { timeout: 10000 });
}

async function waitForHydrated(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, { timeout: 15000 });
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not healthy at ${url}: ${response.status}`);
}

function writeArtifacts() {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify({
    version: "bed-setup.screenshot-index.v1",
    runId,
    generatedAtUtc: new Date().toISOString(),
    screenshots: report.screenshots
  }, null, 2)}\n`);
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}
