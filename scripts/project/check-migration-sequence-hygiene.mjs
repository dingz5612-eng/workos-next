import fs from "node:fs";
import path from "node:path";
import { failIfNeeded, readJson, root, updateProjectHygiene, writeJson } from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const policy = readJson("docs/project/migration-sequence-policy.json");
const migrationDirectory = policy.migrationDirectory ?? "infra/db/migrations";
const fullDirectory = path.join(root, migrationDirectory);
const files = fs.readdirSync(fullDirectory).filter((file) => file.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
const noGoItems = [];

const invalidNames = files.filter((file) => !/^\d{3}_[a-z0-9_]+\.sql$/.test(file));
for (const file of invalidNames) {
  noGoItems.push(`migration 文件名必须为 NNN_snake_case.sql：${file}`);
}

const byOrdinal = new Map();
const stems = new Set();
for (const file of files) {
  const stem = file.replace(/\.sql$/, "");
  if (stems.has(stem)) noGoItems.push(`migration_id 重复：${stem}`);
  stems.add(stem);

  const ordinal = file.slice(0, 3);
  if (!byOrdinal.has(ordinal)) byOrdinal.set(ordinal, []);
  byOrdinal.get(ordinal).push(file);
}

const allowedDuplicateMap = new Map((policy.allowedDuplicateOrdinals ?? []).map((item) => [item.ordinal, item]));
const duplicateOrdinals = Array.from(byOrdinal.entries())
  .filter(([, group]) => group.length > 1)
  .map(([ordinal, group]) => ({ ordinal, files: group }));

for (const duplicate of duplicateOrdinals) {
  const allowed = allowedDuplicateMap.get(duplicate.ordinal);
  if (!allowed) {
    noGoItems.push(`migration ordinal 重复且未登记：${duplicate.ordinal} (${duplicate.files.join(", ")})`);
    continue;
  }
  const expected = [...(allowed.files ?? [])].sort();
  const actual = [...duplicate.files].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    noGoItems.push(`migration ordinal ${duplicate.ordinal} 登记文件与实际不一致：expected ${expected.join(", ")} actual ${actual.join(", ")}`);
  }
}

for (const [ordinal, allowed] of allowedDuplicateMap) {
  if (!byOrdinal.has(ordinal)) {
    noGoItems.push(`migration policy 登记了不存在的重复 ordinal：${ordinal}`);
    continue;
  }
  const actual = [...byOrdinal.get(ordinal)].sort();
  const expected = [...(allowed.files ?? [])].sort();
  if (actual.length > 1 && JSON.stringify(expected) !== JSON.stringify(actual)) {
    noGoItems.push(`migration policy duplicate ordinal ${ordinal} must list all actual files.`);
  }
}

const ordinals = Array.from(byOrdinal.keys()).map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
const minOrdinal = Math.min(...ordinals);
const maxOrdinal = Math.max(...ordinals);
const allowedMissing = new Set((policy.allowedMissingOrdinals ?? []).map((item) => item.ordinal));
const missingOrdinals = [];
for (let ordinal = minOrdinal; ordinal <= maxOrdinal; ordinal += 1) {
  const key = ordinal.toString().padStart(3, "0");
  if (!byOrdinal.has(key)) missingOrdinals.push(key);
}
for (const ordinal of missingOrdinals) {
  if (!allowedMissing.has(ordinal)) noGoItems.push(`migration ordinal 缺口未登记：${ordinal}`);
}
for (const ordinal of allowedMissing) {
  if (!missingOrdinals.includes(ordinal)) noGoItems.push(`migration policy 登记了不存在的缺口：${ordinal}`);
}

const nextRecommendedOrdinal = (maxOrdinal + 1).toString().padStart(3, "0");
if (policy.nextRecommendedOrdinal !== nextRecommendedOrdinal) {
  noGoItems.push(`nextRecommendedOrdinal 必须为 ${nextRecommendedOrdinal}，当前为 ${policy.nextRecommendedOrdinal}`);
}

const result = {
  generatedAtUtc,
  generatedBy: "check-migration-sequence-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  migrationDirectory,
  migrationFileCount: files.length,
  duplicateOrdinals,
  missingOrdinals,
  nextRecommendedOrdinal,
  policyRef: "docs/project/migration-sequence-policy.json",
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/migration-sequence-hygiene.json", result);
updateProjectHygiene("migration_sequence_hygiene", result);
failIfNeeded(noGoItems, "migration sequence hygiene check");
console.log("migration sequence hygiene check: PASS");
