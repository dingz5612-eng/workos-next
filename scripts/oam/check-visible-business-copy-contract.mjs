import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const requireFromMobile = createRequire(path.join(root, "apps/mobile/package.json"));
const { chromium } = requireFromMobile("@playwright/test");
const contractPath = "docs/oam/visible-business-copy-contract.json";
const resultPath = "artifacts/oam/checks/visible-business-copy-contract-result.json";
const failures = [];
const contract = readJson(contractPath, root);

if (contract.version !== "oam.visible-business-copy-contract.v1") fail("contract.version mismatch.");
if (contract.status !== "authoritative") fail("contract.status must be authoritative.");
if (contract.productionConfirmAllowed !== false || contract.releaseAuthority !== false || contract.finalGoNoGo !== "NO_GO") {
  fail("visible business copy contract must keep production/release/final GO closed.");
}
await assertGeneratedBusinessDisplayModule();
assertBusinessDisplayAdapterConsumesGeneratedModule();

const copyValues = [];
for (const file of contract.ordinaryBusinessCopyFiles ?? []) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`ordinary business copy file missing: ${file}.`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  for (const required of contract.requiredScenario1BusinessLabels ?? []) {
    if (!text.includes(required)) fail(`required scenario 1 business label missing: ${required}.`);
  }
  for (const forbidden of contract.forbiddenLegacyScenario1Labels ?? []) {
    if (text.includes(forbidden)) fail(`legacy scenario 1 label must not appear: ${forbidden}.`);
  }
  copyValues.push(...extractStringValues(text).filter(isVisibleCopyValue));
}

const domText = await renderCopyValuesToDom(copyValues);
for (const term of contract.forbiddenVisibleTerms ?? []) {
  if (domText.includes(term)) fail(`ordinary business DOM contains forbidden visible term: ${term}.`);
}

for (const required of contract.requiredScenario1BusinessLabels ?? []) {
  if (!domText.includes(required)) fail(`ordinary business DOM missing required label: ${required}.`);
}

const result = {
  version: "oam.visible-business-copy-contract-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  contractPath,
  contractDigest: fileDigest(contractPath, root),
  domProbe: contract.ordinaryBusinessDomProbe?.probeName ?? null,
  renderedValueCount: copyValues.length,
  forbiddenVisibleTerms: contract.forbiddenVisibleTerms ?? [],
  requiredScenario1BusinessLabels: contract.requiredScenario1BusinessLabels ?? [],
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Visible business copy contract check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Visible business copy contract check: PASS");

function extractStringValues(source) {
  const values = [];
  const pattern = /"[^"]+"\s*:\s*"((?:\\"|[^"])*)"/g;
  let match = pattern.exec(source);
  while (match) {
    values.push(match[1].replace(/\\"/g, "\""));
    match = pattern.exec(source);
  }
  return values;
}

function isVisibleCopyValue(value) {
  return !/^[A-Za-z0-9_.:-]+$/.test(String(value));
}

async function renderCopyValuesToDom(values) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = [
      "<!doctype html>",
      "<html><body>",
      ...values.map((value) => `<button>${escapeHtml(value)}</button>`),
      "</body></html>"
    ].join("");
    await page.setContent(html);
    return await page.locator("body").innerText();
  } finally {
    await browser.close();
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fail(message) {
  failures.push(message);
}

async function assertGeneratedBusinessDisplayModule() {
  const modulePath = contract.businessDisplayGeneratedModule;
  if (!modulePath) {
    fail("businessDisplayGeneratedModule must be declared.");
    return;
  }
  const full = path.join(root, modulePath);
  if (!fs.existsSync(full)) {
    fail(`business display generated module missing: ${modulePath}.`);
    return;
  }
  const generated = await import(`${pathToFileURL(full).href}?check=${Date.now()}`);
  if (JSON.stringify(generated.zhBusinessTermReplacements ?? []) !== JSON.stringify(contract.displayTermReplacementsZh ?? [])) {
    fail("business display generated zhBusinessTermReplacements must match visible business copy contract.");
  }
  if (JSON.stringify(generated.ruBusinessTermReplacements ?? []) !== JSON.stringify(contract.displayTermReplacementsRu ?? [])) {
    fail("business display generated ruBusinessTermReplacements must match visible business copy contract.");
  }
  if (JSON.stringify(generated.kyBusinessTermReplacements ?? []) !== JSON.stringify(contract.displayTermReplacementsKy ?? [])) {
    fail("business display generated kyBusinessTermReplacements must match visible business copy contract.");
  }
  if (JSON.stringify(generated.zhRiskLabelReplacements ?? {}) !== JSON.stringify(contract.riskLabelReplacementsZh ?? {})) {
    fail("business display generated zhRiskLabelReplacements must match visible business copy contract.");
  }
  if (generated.businessDisplayLanguageContract?.finalGoNoGo !== "NO_GO") {
    fail("business display generated module must preserve finalGoNoGo=NO_GO.");
  }
}

function assertBusinessDisplayAdapterConsumesGeneratedModule() {
  const adapterPath = contract.businessDisplayAdapter;
  if (!adapterPath) {
    fail("businessDisplayAdapter must be declared.");
    return;
  }
  const full = path.join(root, adapterPath);
  if (!fs.existsSync(full)) {
    fail(`business display adapter missing: ${adapterPath}.`);
    return;
  }
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes("business-display-language.generated.js")) {
    fail("business display adapter must consume generated business-display-language module.");
  }
  for (const [sourceTerm] of contract.displayTermReplacementsZh ?? []) {
    if (text.includes(sourceTerm)) {
      fail(`business display adapter must not hardcode source term: ${sourceTerm}.`);
    }
  }
  for (const [sourceTerm] of [
    ...(contract.displayTermReplacementsRu ?? []),
    ...(contract.displayTermReplacementsKy ?? [])
  ]) {
    if (text.includes(sourceTerm)) {
      fail(`business display adapter must not hardcode source term: ${sourceTerm}.`);
    }
  }
}
