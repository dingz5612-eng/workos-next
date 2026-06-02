import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const root = process.cwd();
export const copyModules = [
  "apps/mobile/src/i18n/shellCopy.js",
  "apps/mobile/src/i18n/domainCopy.js",
  "apps/mobile/src/i18n/coachCopy.js",
  "apps/mobile/src/i18n/operationCopy.js"
];

export function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function gitHead() {
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" }).stdout.trim();
}

export function result(generatedBy, noGoItems, extra = {}) {
  return {
    generatedAtUtc: new Date().toISOString(),
    generatedBy,
    stage: "OAM-LOCALIZATION-AUTHORITY",
    status: noGoItems.length ? "failed" : "passed",
    repositoryHead: gitHead(),
    languages: {
      canonical: "zh-CN",
      supported: ["ru-RU"],
      pilot: ["ky-KG"]
    },
    noGoItems,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview",
    ...extra
  };
}

export function failIfNeeded(noGoItems, label) {
  if (!noGoItems.length) return;
  for (const item of noGoItems) console.error(`P0 ${item}`);
  throw new Error(`${label} failed.`);
}

export function keysForLanguage(source, language) {
  const block = source.match(new RegExp(`"${language}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m"))?.[1] || "";
  return [...block.matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1]).sort();
}
