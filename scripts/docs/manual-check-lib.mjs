import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const root = process.cwd();
export const requiredManuals = [
  "docs/manuals/system/system-manual.md",
  "docs/manuals/project/project-manual.md",
  "docs/manuals/runtime/runtime-operations-manual.md",
  "docs/manuals/user/frontdesk-user-manual-zh-CN.md",
  "docs/manuals/user/finance-user-manual-zh-CN.md",
  "docs/manuals/user/manager-user-manual-zh-CN.md",
  "docs/manuals/user/governance-user-manual-zh-CN.md",
  "docs/manuals/user/release-owner-user-manual-zh-CN.md",
  "docs/manuals/operations/dormitory-l1-sop.md",
  "docs/manuals/project/post-oam-04b-04c-pure-baseline-report.md"
];

export const requiredStateLines = [
  "Dormitory remains L1 Internal Pilot Observation only",
  "Dormitory L2 Production = false",
  "Business Production = blocked",
  "Repair / Parts / HR = L0 Contract Preview"
];

export function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

export function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function gitHead() {
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" }).stdout.trim();
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function failIfNeeded(noGoItems, label) {
  if (!noGoItems.length) return;
  for (const item of noGoItems) console.error(`P0 ${item}`);
  throw new Error(`${label} failed.`);
}

export function manualResult(generatedBy, noGoItems, extra = {}) {
  return {
    generatedAtUtc: new Date().toISOString(),
    generatedBy,
    stage: "OAM-MANUAL-CONTROL-PLANE",
    status: noGoItems.length ? "failed" : "passed",
    repositoryHead: gitHead(),
    manualCount: requiredManuals.length,
    noGoItems,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview",
    ...extra
  };
}
