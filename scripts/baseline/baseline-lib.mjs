import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = process.cwd();

export const baselineRefs = {
  releaseEvidence: "artifacts/baseline/release-evidence-baseline.json",
  artifact: "artifacts/baseline/artifact-inventory.json",
  runtimeSemantic: "artifacts/baseline/runtime-semantic-baseline.json",
  surfaceUx: "artifacts/baseline/surface-ux-baseline.json",
  seedData: "artifacts/baseline/seed-data-baseline.json",
  portfolioBoundary: "artifacts/baseline/portfolio-boundary-baseline.json",
  cleanBaseline: "artifacts/baseline/oam-clean-baseline-result.json"
};

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

export function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

export function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

export function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

export function currentHead() {
  return git(["rev-parse", "HEAD"]);
}

export function originMainHead() {
  return git(["rev-parse", "origin/main"]);
}

export function isDirectRun(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  return JSON.stringify(sortKeys(value));
}

export function collectStrings(value, strings = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, strings);
  } else if (typeof value === "string") {
    strings.push(value.replace(/\\/g, "/"));
  }
  return strings;
}

export function noTmpRefs(value) {
  return collectStrings(value).filter((item) => item.includes(".tmp/"));
}

export function productionLeaks(value) {
  const text = JSON.stringify(value);
  const leaks = [];
  if (/BUSINESS_PRODUCTION_GO|DORMITORY_L2_PRODUCTION_ALLOWED|REPAIR_PARTS_HR_PRODUCTION_ALLOWED|PRODUCTION_READY|FULLY_PASSED/.test(text)) {
    leaks.push("禁止状态枚举出现在 baseline。");
  }
  if (/"productionAllowed"\s*:\s*true/.test(text)) leaks.push("productionAllowed=true");
  if (/"dormitoryL2ProductionAllowed"\s*:\s*true/.test(text)) leaks.push("dormitoryL2ProductionAllowed=true");
  if (/"businessProductionAllowed"\s*:\s*true/.test(text)) leaks.push("businessProductionAllowed=true");
  if (/"repairPartsHrProductionAllowed"\s*:\s*true/.test(text)) leaks.push("repairPartsHrProductionAllowed=true");
  return leaks;
}

export function statusOf(value) {
  return value?.status ?? value?.finalStatus ?? value?.decision ?? "unknown";
}

export function requirePassed(value, label, failures, accepted = ["passed"]) {
  const status = statusOf(value);
  if (!accepted.includes(status)) failures.push(`${label} 状态必须为 ${accepted.join(" / ")}，当前为 ${status}。`);
}

export function requireNoGoEmpty(value, label, failures) {
  const items = value?.noGoItems ?? value?.no_go_items ?? value?.violations ?? [];
  if (Array.isArray(items) && items.length > 0) failures.push(`${label} 存在未关闭 noGoItems / violations。`);
}

export function writeBaselineReport(summary) {
  const lines = [
    "# OAM 干净基线最终门禁报告",
    "",
    `生成时间：${summary.generatedAtUtc}`,
    "",
    "## 门禁结论",
    "",
    `- 阶段状态：${summary.status}`,
    "- Dormitory remains L1 Internal Pilot Observation only.",
    "- Dormitory L2 Production = false.",
    "- Business Production = blocked.",
    "- Repair / Parts / HR = L0 Contract Preview.",
    "- Day-2 只能在 clean baseline、post-merge attestation、observation sequence gate 都通过后继续。",
    "",
    "## 六个基线",
    "",
    ...Object.entries(summary.baselines ?? {}).map(([key, value]) => `- ${key}: ${value.status}`),
    "",
    "## 阻断项",
    "",
    ...(summary.noGoItems?.length ? summary.noGoItems.map((item) => `- ${item}`) : ["- 无 P0 阻断项。"])
  ];
  writeText("docs/baseline/oam-clean-baseline.md", `${lines.join("\n")}\n`);
}

export function failIfNeeded(failures, label) {
  if (!failures.length) return;
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error(`${label} failed.`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortKeys(nested)]));
}
