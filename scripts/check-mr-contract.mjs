import fs from "node:fs";
import path from "node:path";

const contractDir = path.join("docs", "rules", "v5.5", "mr-contracts");
const requiredFields = [
  "mrId",
  "name",
  "state",
  "owners",
  "scope",
  "includes",
  "excludes",
  "dependencies",
  "goCriteria",
  "noGoCriteria",
  "invariants",
  "shadowPath",
  "pilotPath",
  "activePath",
  "rollbackInstruction",
  "compensationInstruction",
  "acceptanceScenarios",
  "gateResultRequired"
];

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

const violations = [];
for (let index = 0; index <= 10; index += 1) {
  const mrId = `MR-${String(index).padStart(2, "0")}`;
  const file = path.join(contractDir, `${mrId}.yml`);
  if (!fs.existsSync(file)) {
    violations.push(`Missing MR contract: ${file}`);
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  if (!new RegExp(`^mrId:\\s*${mrId}$`, "m").test(source)) {
    violations.push(`${file} must declare mrId: ${mrId}`);
  }

  for (const field of requiredFields) {
    if (!new RegExp(`^\\s*${field}:`, "m").test(source)) {
      violations.push(`${file} missing ${field}`);
    }
  }

  if (/state:\s*(active|locked)/.test(source)) {
    for (const field of ["owners", "rollbackInstruction", "gateResultRequired"]) {
      if (!new RegExp(`^\\s*${field}:\\s*(?!\\[\\]|planned|false)`, "m").test(source)) {
        violations.push(`${file} active/locked contract must have concrete ${field}`);
      }
    }
  }
}

const template = fs.readFileSync(".github/pull_request_template.md", "utf8");
for (const term of [
  "MR",
  "Slice",
  "Runtime Layer",
  "Fact Ownership",
  "API Boundary",
  "Idempotency",
  "Evidence",
  "Ledger",
  "Process / Blocker",
  "Projection / Lens",
  "Mobile",
  "PC",
  "Migration / Release",
  "No-Go"
]) {
  if (!template.includes(term)) {
    violations.push(`PR template missing contract prompt: ${term}`);
  }
}

if (violations.length > 0) {
  fail("MR contract check failed.", violations);
}

console.log("MR contract check: PASS");
