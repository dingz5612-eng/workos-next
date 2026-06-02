import fs from "node:fs";
import path from "node:path";
import { failIfNeeded, root, sha256, stableJson, writeJson } from "../oam/clean-baseline-lib.mjs";

const dryRun = process.argv.includes("--dry-run");
const ledgerPath = path.join(root, "artifacts/operations/dormitory/observation-ledger.jsonl");
const failures = [];

if (!fs.existsSync(ledgerPath)) failures.push("observation-ledger.jsonl 不存在，请先运行 check-observation-sequence-gate。");

const entries = fs.existsSync(ledgerPath)
  ? fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  : [];

let previousHash = "GENESIS";
const days = new Set();
for (const entry of entries) {
  if (days.has(entry.day)) failures.push(`observation ledger 不得重复 day=${entry.day}。`);
  days.add(entry.day);
  if (entry.previousHash !== previousHash) failures.push(`day=${entry.day} previousHash 不匹配。`);
  const expected = sha256(stableJson({ ...entry, entryHash: undefined }));
  if (entry.entryHash !== expected) failures.push(`day=${entry.day} entryHash 不可重算。`);
  previousHash = entry.entryHash;
}

const latestDay = entries.length ? Math.max(...entries.map((entry) => entry.day)) : null;
const result = {
  generatedAtUtc: new Date().toISOString(),
  generatedBy: "append-observation-ledger",
  dryRun,
  status: failures.length === 0 ? "passed" : "failed",
  latestDay,
  appendOnly: failures.length === 0,
  entryCount: entries.length,
  noGoItems: failures
};
writeJson("artifacts/operations/dormitory/observation-ledger-check-result.json", result);

failIfNeeded(failures, "observation ledger append-only check");
console.log(`observation ledger append-only ${dryRun ? "dry-run " : ""}check: PASS`);

