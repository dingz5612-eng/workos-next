import fs from "node:fs";

const registryPath = "docs/rules/v5.5/fact-ownership.yml";
const requiredFacts = [
  "Room",
  "Bed",
  "BedStatus",
  "RatePlan",
  "Resident",
  "Stay",
  "Charge",
  "Payment",
  "PaymentAllocation",
  "DepositAccount",
  "DepositEntry",
  "CheckoutCase",
  "ServiceTask",
  "PeriodSnapshot",
  "EvidenceObject",
  "EvidenceFile",
  "LedgerEntry",
  "DomainEvent",
  "WorkItem",
  "CommandSubmission",
  "LensSnapshot"
];

const requiredFields = [
  "owner",
  "allowedWriters",
  "forbiddenWriters",
  "allowedReaders",
  "allowedRequesters",
  "domainEvents",
  "ledgerEntries",
  "invariants",
  "appendOnly",
  "correctionPath",
  "projectionOwners"
];

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

const source = fs.readFileSync(registryPath, "utf8");
const blocks = new Map();
const factMatches = [...source.matchAll(/^\s*-\s+fact:\s*([A-Za-z0-9_]+)\s*$/gm)];
for (let index = 0; index < factMatches.length; index += 1) {
  const match = factMatches[index];
  const next = factMatches[index + 1];
  blocks.set(match[1], source.slice(match.index, next?.index ?? source.length));
}

const missingFacts = requiredFacts.filter((fact) => !blocks.has(fact));
if (missingFacts.length > 0) {
  fail("Fact ownership registry missing required facts.", missingFacts);
}

const violations = [];
for (const fact of requiredFacts) {
  const block = blocks.get(fact) ?? "";
  for (const field of requiredFields) {
    if (!new RegExp(`^\\s*${field}:`, "m").test(block)) {
      violations.push(`${fact} missing ${field}`);
    }
  }
  if (!/forbiddenWriters:.*(mobile-bff|pc-governance-direct-sql|non-owner-slice)/.test(block.replace(/\n/g, " "))) {
    violations.push(`${fact} must explicitly block at least one non-owner writer class`);
  }
  if (!/invariants:\s*\[[^\]]+\]/.test(block)) {
    violations.push(`${fact} must declare at least one invariant`);
  }
}

const ownershipDoc = fs.readFileSync("docs/engineering/02-runtime-ownership-rules.md", "utf8");
for (const requiredTerm of [
  "Process managers create WorkItems",
  "Mobile BFF never writes business facts",
  "Corrections are append-only"
]) {
  if (!ownershipDoc.includes(requiredTerm)) {
    violations.push(`docs/engineering/02-runtime-ownership-rules.md missing: ${requiredTerm}`);
  }
}

if (violations.length > 0) {
  fail("Fact ownership check failed.", violations);
}

console.log("Fact ownership check: PASS");
