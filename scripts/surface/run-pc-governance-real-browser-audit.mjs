import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../../apps/mobile/node_modules/playwright");

const root = process.cwd();
const baseUrl = process.env.WORKOS_MOBILE_URL || "http://127.0.0.1:5175";
const apiUrl = process.env.WORKOS_API_URL || "http://127.0.0.1:5191";
const runId = process.env.WORKOS_PC_GOVERNANCE_AUDIT_RUN_ID || `pc-governance-real-browser-${timestampId()}`;
const artifactRoot = path.join(
  root,
  "artifacts", "oma", "evidence", "pc-governance-real-browser",
  runId);
const screenshotRoot = path.join(artifactRoot, "screenshots");
const reportPath = path.join(artifactRoot, "pc-governance-real-browser-report.json");
const markdownPath = path.join(artifactRoot, "pc-governance-real-browser-report.md");
const screenshotIndexPath = path.join(artifactRoot, "screenshot-index.json");

fs.mkdirSync(screenshotRoot, { recursive: true });

const report = {
  version: "pc-governance.real-browser-audit.v1",
  status: "running",
  runId,
  generatedAtUtc: new Date().toISOString(),
  browserMode: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1" ? "playwright-chromium-headless" : "playwright-chromium-visible",
  mockPolicy: "real browser clicks and form input only; no route mocks; no backend simulation; no API substitute for user operations",
  endpoints: { baseUrl, apiUrl },
  steps: [],
  screenshots: [],
  networkEvents: [],
  assertions: [],
  findings: []
};

try {
  await requireHealthy(`${apiUrl}/health`, "Core API");
  await requireHealthy(baseUrl, "Mobile frontend");

  const browser = await chromium.launch({
    headless: process.env.WORKOS_REAL_BROWSER_HEADLESS === "1",
    slowMo: Number(process.env.WORKOS_REAL_BROWSER_SLOWMO_MS || 50)
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 980 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });
    const page = await context.newPage();
    page.on("response", (response) => collectNetwork(response));

    await loginAsAdmin(page);
    await openGovernanceCenter(page);
    await capture(page, "01-governance-dashboard", "PC 治理中心首屏");
    await clickGovernanceNav(page);
    await exerciseAccountManagement(page);

    await context.close();
  } finally {
    await browser.close();
  }

  addNetworkAssertions();
  report.status = report.findings.length || report.assertions.some((item) => item.status !== "passed") ? "failed" : "passed";
  writeArtifacts();
  if (report.status !== "passed") {
    console.error(`PC Governance real browser audit: FAIL (${report.findings.length} findings)`);
    process.exitCode = 1;
  } else {
    console.log(`PC Governance real browser audit: PASS (${runId})`);
    console.log(rel(reportPath));
  }
} catch (error) {
  report.status = "failed";
  report.failureReason = error?.stack || error?.message || String(error);
  writeArtifacts();
  console.error("PC Governance real browser audit: FAIL");
  console.error(report.failureReason);
  process.exitCode = 1;
}

async function loginAsAdmin(page) {
  await page.goto(`${baseUrl}/?view=login&lang=zh-CN&device=pc`, { waitUntil: "domcontentloaded" });
  await waitForHydrated(page);
  await capture(page, "00-login", "PC 管理员登录页");
  await fill(page, "#loginAccount", "admin");
  await fill(page, "#loginPassword", "dev");
  await click(page, "#loginSubmit");
  await page.waitForFunction(() => !document.querySelector("#loginSubmit"), null, { timeout: 30_000 });
  await waitForHydrated(page);
  await capture(page, "00-login-complete", "PC 管理员登录完成");
}

async function openGovernanceCenter(page) {
  await page.goto(`${baseUrl}/?view=governanceCenter&lang=zh-CN&device=pc`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-pc-governance-full]", { timeout: 30_000 });
  await waitForHydrated(page);
  const dom = await readDomState(page);
  addAssertion("pc.surface.loaded", dom.pcGovernanceFullCount === 1, "PC 治理中心必须渲染 PC governance shell。", dom);
  addAssertion("pc.mobile_shell_absent", dom.bottomNavCount === 0, "PC 治理页面不得混入移动底部导航。", dom);
  addAssertion("pc.top_menu.single_default_section", dom.visibleGovernanceSections.length === 1 && dom.visibleGovernanceSections.includes("dashboard"), "PC 治理默认必须是顶部菜单 + 单一当前分区，不得铺满全部治理区。", dom);
  addAssertion("pc.nav.grouped", dom.governanceNavGroupCount >= 4, "PC 治理顶部菜单必须按只读、证据、受控操作、权限治理分类。", dom);
  addAssertion("pc.help.present", dom.governanceHelpCount >= dom.governanceSectionCount, "PC 治理每个分区必须提供默认收起的说明入口。", dom);
}

async function clickGovernanceNav(page) {
  const items = await page.locator("[data-governance-nav]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.getAttribute("data-governance-nav") || node.textContent || "",
      sectionId: String(node.getAttribute("href") || "").replace(/^#/, "")
    })).filter((item) => item.label && item.sectionId));
  const labels = items.map((item) => item.label);
  addAssertion("pc.nav.present", labels.length >= 8, "PC 治理中心必须有可点击治理分区导航。", { labels });
  for (const [index, item] of items.entries()) {
    await click(page, `[data-governance-nav="${cssEscape(item.label)}"]`);
    await waitForHydrated(page);
    const step = await capture(page, `02-nav-${String(index + 1).padStart(2, "0")}-${safeName(item.label)}`, `PC 治理分区：${item.label}`);
    addAssertion(`pc.nav.${item.sectionId}.single_section`, step.domState.visibleGovernanceSections.length === 1 && step.domState.visibleGovernanceSections.includes(item.sectionId), `点击顶部菜单 ${item.label} 后只能显示当前治理分区。`, step.domState);
    addAssertion(`pc.nav.${item.sectionId}.classified`, Boolean(step.domState.visibleSectionMode), `治理分区 ${item.label} 必须标明只读/可操作/治理分类。`, step.domState);
    addAssertion(`pc.nav.${item.sectionId}.help_present`, step.domState.visibleSectionHelpCount === 1, `治理分区 ${item.label} 必须有说明入口。`, step.domState);
    const helpSummary = page.locator(`[data-pc-section="${cssEscape(item.sectionId)}"] [data-governance-help] summary`).first();
    if (await helpSummary.isVisible().catch(() => false)) {
      await helpSummary.click();
      await waitForHydrated(page);
      const helpStep = await capture(page, `02-nav-${String(index + 1).padStart(2, "0")}-${safeName(item.label)}-help`, `PC 治理分区说明：${item.label}`);
      addAssertion(`pc.nav.${item.sectionId}.help_content`, /能做什么|不能做什么|权限与证据/.test(helpStep.domState.visibleSectionText), `治理分区 ${item.label} 的说明必须解释能做、不能做、权限与证据。`, helpStep.domState);
      await helpSummary.click();
      await waitForHydrated(page);
    }
  }
}

async function exerciseAccountManagement(page) {
  const suffix = crypto.createHash("sha1").update(`${runId}:${Date.now()}`).digest("hex").slice(0, 8);
  const username = `auditUser${suffix}`;
  const displayName = `真实浏览器审计${suffix}`;
  await click(page, `[data-governance-nav="Account Users"]`);
  await page.locator("#account-users").scrollIntoViewIfNeeded();
  await waitForHydrated(page);
  await capture(page, "03-account-users-before-create", "用户与权限管理创建前");

  await fill(page, "#accountUsername", username);
  await fill(page, "#accountDisplayName", displayName);
  await fill(page, "#accountPassword", `Dev-${suffix}-123`);
  await fill(page, "#accountDepartment", "住宿运营部");
  await fill(page, "#accountBusinessLine", "stay");
  await select(page, "[data-account-role-select]", "operator");
  await capture(page, "04-account-users-form-filled", "用户与权限表单填写完成");

  const createResponse = page.waitForResponse((response) =>
    response.url().includes("/api/pc-governance/account-users") &&
    response.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
  await click(page, "[data-account-user-create]");
  const created = await createResponse;
  await page.waitForFunction((name) => document.body.innerText.includes(name), username, { timeout: 30_000 });
  await waitForHydrated(page);
  await capture(page, "05-account-user-created", "管理员创建用户后");
  addAssertion("account.create.posted", Boolean(created) && created.status() < 500, "创建用户必须通过 PC Governance Account/User Kernel API。", { status: created?.status() || 0 });
  const createdDom = await readDomState(page);
  addAssertion("account.create.visible", createdDom.accountUserSectionText.includes(username), "新用户必须出现在用户列表。", { username, accountUserSectionText: createdDom.accountUserSectionText });

  const row = page.locator("tr", { hasText: username }).first();
  const resetInput = row.locator("[data-account-reset-password]").first();
  const resetButton = row.locator("[data-account-password-reset]").first();
  await resetInput.fill(`Reset-${suffix}-123`);
  const resetResponse = page.waitForResponse((response) =>
    response.url().includes("/reset-password") &&
    response.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
  await resetButton.click();
  const reset = await resetResponse;
  await waitForHydrated(page);
  await capture(page, "06-account-password-reset", "管理员重置密码后");
  addAssertion("account.password_reset.posted", Boolean(reset) && reset.status() < 500, "重置密码必须通过后端 Account/User Kernel。", { status: reset?.status() || 0 });

  const disableResponse = page.waitForResponse((response) =>
    response.url().includes("/disable") &&
    response.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
  await row.locator("[data-account-user-disable]").first().click();
  const disabled = await disableResponse;
  await page.waitForFunction((name) => {
    const rowText = Array.from(document.querySelectorAll("tr"))
      .find((row) => row.textContent?.includes(name))?.textContent || "";
    return rowText.includes("disabled");
  }, username, { timeout: 30_000 });
  await waitForHydrated(page);
  await capture(page, "07-account-user-disabled", "管理员禁用用户后");
  addAssertion("account.disable.posted", Boolean(disabled) && disabled.status() < 500, "禁用账号必须通过后端 Account/User Kernel。", { status: disabled?.status() || 0 });

  await click(page, `[data-governance-nav="Account Users"]`);
  await page.locator("#account-users").scrollIntoViewIfNeeded();
  await waitForHydrated(page);
  await capture(page, "08-account-audit-visible", "账号治理审计可见");
  const finalDom = await readDomState(page);
  addAssertion("account.audit.visible", /AccountUserCreated|AccountUserPasswordReset|AccountUserDisabled|账号审计/.test(finalDom.accountUserSectionText), "账号创建、重置、禁用必须可审计。", finalDom);
}

async function capture(page, stepId, title) {
  await waitForHydrated(page);
  const domState = await readDomState(page);
  const safe = safeName(stepId);
  const fullPath = path.join(screenshotRoot, `${safe}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const segments = await captureSegments(page, safe);
  const step = {
    stepId,
    title,
    url: page.url(),
    atUtc: new Date().toISOString(),
    domState,
    screenshot: screenshotEntry(fullPath, "fullPage"),
    segments
  };
  report.steps.push(step);
  report.screenshots.push(step.screenshot, ...segments);
  return step;
}

async function captureSegments(page, safe) {
  const viewport = page.viewportSize() || { width: 1440, height: 980 };
  const scrollHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const maxY = Math.max(0, scrollHeight - viewport.height);
  const positions = maxY > 0 ? [{ kind: "top", y: 0 }, { kind: "bottom", y: maxY }] : [{ kind: "top", y: 0 }];
  const entries = [];
  const seen = new Set();
  for (const position of positions) {
    if (seen.has(position.y)) continue;
    seen.add(position.y);
    await page.evaluate((y) => window.scrollTo(0, y), position.y);
    await page.waitForTimeout(120);
    const segmentPath = path.join(screenshotRoot, `${safe}-${position.kind}.png`);
    await page.screenshot({ path: segmentPath, fullPage: false });
    entries.push(screenshotEntry(segmentPath, position.kind, position.y));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return entries;
}

async function readDomState(page) {
  return page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent?.trim() || "",
    pcGovernanceFullCount: document.querySelectorAll("[data-pc-governance-full]").length,
    governanceSectionCount: document.querySelectorAll("[data-pc-section]").length,
    governanceNavGroupCount: document.querySelectorAll("[data-governance-nav-group]").length,
    governanceHelpCount: document.querySelectorAll("[data-governance-help]").length,
    visibleGovernanceSections: Array.from(document.querySelectorAll("[data-pc-section]")).filter((node) => {
      const style = window.getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().height > 0;
    }).map((node) => node.dataset.pcSection || node.id || ""),
    visibleSectionMode: Array.from(document.querySelectorAll("[data-pc-section]")).find((node) => {
      const style = window.getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().height > 0;
    })?.querySelector("[data-governance-mode]")?.getAttribute("data-governance-mode") || "",
    visibleSectionHelpCount: (() => {
      const section = Array.from(document.querySelectorAll("[data-pc-section]")).find((node) => {
        const style = window.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().height > 0;
      });
      return section?.querySelectorAll("[data-governance-help]").length || 0;
    })(),
    visibleSectionText: (() => {
      const section = Array.from(document.querySelectorAll("[data-pc-section]")).find((node) => {
        const style = window.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().height > 0;
      });
      return (section?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2600);
    })(),
    activeGovernanceNav: document.querySelector("[data-governance-nav][aria-current='page']")?.getAttribute("data-governance-nav") || "",
    accountManagementCount: document.querySelectorAll("[data-account-user-management]").length,
    accountCreateDisabled: document.querySelector("[data-account-user-create]")?.hasAttribute("disabled") ?? true,
    bottomNavCount: document.querySelectorAll("nav.bottom-nav").length,
    accountUserSectionText: (document.querySelector("[data-account-user-management]")?.innerText || "").replace(/\s+/g, " ").trim(),
    textSample: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2200),
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    viewportHeight: window.innerHeight,
    url: window.location.href
  }));
}

async function click(page, selector) {
  const target = await firstVisible(page.locator(selector));
  await target.click();
  await waitForHydrated(page);
}

async function fill(page, selector, value) {
  const target = await firstVisible(page.locator(selector));
  await target.fill(value);
  await page.waitForTimeout(100);
}

async function select(page, selector, value) {
  const target = await firstVisible(page.locator(selector));
  await target.selectOption(value);
  await page.waitForTimeout(160);
}

async function firstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return locator.first();
}

async function waitForHydrated(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(180);
  await page.waitForFunction(() => !document.querySelector("[data-surface=\"runtime-hydration\"]"), null, { timeout: 15_000 }).catch(() => {});
}

function collectNetwork(response) {
  const url = response.url();
  if (!url.startsWith(apiUrl)) return;
  const request = response.request();
  report.networkEvents.push({
    atUtc: new Date().toISOString(),
    method: request.method(),
    url,
    path: safePath(url),
    status: response.status()
  });
}

function addNetworkAssertions() {
  const writes = report.networkEvents.filter((event) => event.method !== "GET");
  const accountCreates = writes.filter((event) => event.method === "POST" && event.path === "/api/pc-governance/account-users");
  const passwordResets = writes.filter((event) => event.method === "POST" && /\/api\/pc-governance\/account-users\/[^/]+\/reset-password$/.test(event.path));
  const disables = writes.filter((event) => event.method === "POST" && /\/api\/pc-governance\/account-users\/[^/]+\/disable$/.test(event.path));
  const legacyWorkspaceCardWrites = writes.filter((event) => /\/api\/workspaces\/[^/]+\/cards\/[^/]+\/(prepare|confirm)$/i.test(event.path));
  const directBusinessFactWrites = writes.filter((event) => /\/api\/(audit-events|outbox|projections\/process-outbox)$/i.test(event.path));
  addAssertion("network.account_create_count", accountCreates.length === 1, "PC 治理真实操作必须创建 1 个账号。", { accountCreates });
  addAssertion("network.account_reset_count", passwordResets.length === 1, "PC 治理真实操作必须重置 1 次密码。", { passwordResets });
  addAssertion("network.account_disable_count", disables.length === 1, "PC 治理真实操作必须禁用 1 个账号。", { disables });
  addAssertion("network.no_legacy_workspace_card_writes", legacyWorkspaceCardWrites.length === 0, "PC 治理不得调用旧 Workspace/Card 写入口。", { legacyWorkspaceCardWrites });
  addAssertion("network.no_direct_business_fact_writes", directBusinessFactWrites.length === 0, "PC 治理不得直接写业务事实、outbox 或投影。", { directBusinessFactWrites });
}

function addAssertion(id, passed, message, details = {}) {
  const assertion = { id, status: passed ? "passed" : "failed", severity: passed ? "none" : "P0", message, details };
  report.assertions.push(assertion);
  if (!passed) report.findings.push({ id, severity: "P0", message, details });
}

function writeArtifacts() {
  const screenshotIndex = {
    version: "pc-governance.screenshot-index.v1",
    runId,
    generatedAtUtc: report.generatedAtUtc,
    screenshots: report.screenshots
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(screenshotIndexPath, `${JSON.stringify(screenshotIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, markdownReport(), "utf8");
}

function markdownReport() {
  return [
    "# PC Governance Real Browser Audit",
    "",
    `- Run ID: ${report.runId}`,
    `- Status: ${report.status}`,
    `- Browser mode: ${report.browserMode}`,
    `- Mock policy: ${report.mockPolicy}`,
    `- Step count: ${report.steps.length}`,
    `- Screenshot count: ${report.screenshots.length}`,
    "",
    "| Assertion | Status |",
    "| --- | --- |",
    ...report.assertions.map((item) => `| ${item.id} | ${item.status} |`)
  ].join("\n") + "\n";
}

function screenshotEntry(filePath, kind, scrollY = null) {
  return {
    kind,
    path: rel(filePath),
    absolutePath: filePath,
    sha256: sha256(filePath),
    bytes: fs.statSync(filePath).size,
    scrollY
  };
}

async function requireHealthy(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} is not reachable: ${url} (${response.status})`);
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z").toLowerCase();
}

function safePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
