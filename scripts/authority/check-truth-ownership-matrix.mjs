import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "schemas/authority/truth-ownership-matrix.schema.json";
const contractPath = "docs/contracts/authority/truth-ownership-matrix.contract.json";
const registryPath = "docs/business/truth-owner-registry.yml";
const resultPath = "artifacts/oam/checks/truth-ownership-matrix-result.json";
const proofPath = "artifacts/oam/evidence/truth-ownership-proof.json";
const writeProofArtifact = process.argv.includes("--write-proof") || process.env.OAM_WRITE_PROOF === "1";
const violations = [];

const schema = readJson(schemaPath);
const contract = readJson(contractPath);
const registry = readJson(registryPath);
const registryOwners = new Map((registry.truthOwners ?? []).map((item) => [item.factId, item]));
const requiredChain = ["AmountBasisProposal", "AmountBasisReviewed", "AmountBasis", "FinancialFact", "LedgerTransaction", "LedgerEntry"];
const readSideForbiddenOwners = ["Search", "Surface", "Dashboard", "Report", "Metric"];

if (schema.$id !== "workosnext.authority.truth-ownership-matrix.schema.v1") {
  fail("truth_matrix.schema_id", `${schemaPath} $id mismatch.`);
}
for (const field of [
  "version",
  "status",
  "architecture",
  "matrixId",
  "truthOwners",
  "financeStateChain",
  "readSideBoundaries",
  "readSideWritersForbiddenOwners",
  "evidenceObjectPolicy",
  "negativeFixtures"
]) {
  if (!(schema.required ?? []).includes(field)) fail("truth_matrix.schema_required", `${schemaPath} must require ${field}.`);
}
for (const [field, expected] of Object.entries({
  version: "workosnext.authority.truth-ownership-matrix.v1",
  status: "authoritative-current-no-go",
  architecture: "oam.current"
})) {
  if (contract[field] !== expected) fail("truth_matrix.contract_identity", `${contractPath} ${field} mismatch.`);
}
requirePath(contract.truthOwnerRegistryRef, "truthOwnerRegistryRef");
checkUniqueTruthOwners(contract.truthOwners ?? [], "contract");
checkRegistryTruthOwners();
if (JSON.stringify(contract.financeStateChain) !== JSON.stringify(requiredChain)) {
  fail("truth_matrix.finance_chain", "Finance state chain must be AmountBasisProposal -> AmountBasisReviewed -> AmountBasis -> FinancialFact -> LedgerTransaction -> LedgerEntry.");
}
checkContractTruthOwners();
for (const factId of requiredChain) {
  const owner = registryOwners.get(factId);
  if (!owner) {
    fail("truth_matrix.registry_fact_missing", `${registryPath} missing ${factId}.`);
    continue;
  }
  if (["FinancialFact", "LedgerTransaction", "LedgerEntry"].includes(factId) && owner.truthLevel !== "centerTruth") {
    fail("truth_matrix.center_truth_missing", `${factId} must remain centerTruth.`);
  }
  if (["LedgerTransaction", "LedgerEntry"].includes(factId) && owner.owner !== "MoneyKernelPack") {
    fail("truth_matrix.money_owner_drift", `${factId} must be owned by MoneyKernelPack.`);
  }
}
for (const readSide of ["SearchResult", "LensReadModel", "DashboardSummary", "SharedReceipt", "ReportDataset", "MetricDefinition"]) {
  if (!(contract.readSideBoundaries ?? []).includes(readSide)) {
    fail("truth_matrix.read_side_missing", `Missing read-side boundary ${readSide}.`);
  }
}
if (contract.readSideFinanceTruthAllowed !== false || contract.nonOwnerCommitAllowed !== false) {
  fail("truth_matrix.boundary_drift", "Read side finance truth and non-owner commits must remain forbidden.");
}
checkReadSideWriters();
checkEvidenceObjectPolicy();
checkFinanceWritePolicy();
checkNegativeFixtures();

writeResult();
if (writeProofArtifact) writeProof();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Truth ownership matrix check: PASS");

function checkUniqueTruthOwners(items, label) {
  const seen = new Map();
  for (const item of items) {
    if (!item.factId) {
      fail("truth_matrix.fact_id_missing", `${label} contains truth owner without factId.`);
      continue;
    }
    if (seen.has(item.factId)) {
      fail("truth_matrix.owner_conflict_p0", `${label} factId ${item.factId} has multiple truth owners: ${seen.get(item.factId)} and ${item.owner}.`);
    } else {
      seen.set(item.factId, item.owner);
    }
    if (!item.owner) fail("truth_matrix.owner_missing", `${label} factId ${item.factId} missing owner.`);
    if (!Array.isArray(item.allowedCommitters)) {
      fail("truth_matrix.allowed_committers_missing", `${label} factId ${item.factId} must declare allowedCommitters.`);
    } else if (item.truthLevel !== "readModel" && item.allowedCommitters.length === 0) {
      fail("truth_matrix.allowed_committers_empty", `${label} factId ${item.factId} must declare at least one allowed committer unless it is readModel.`);
    }
    if (!Array.isArray(item.forbiddenOwners) || item.forbiddenOwners.length === 0) {
      fail("truth_matrix.forbidden_owners_missing", `${label} factId ${item.factId} must declare forbiddenOwners.`);
    }
  }
}

function checkRegistryTruthOwners() {
  checkUniqueTruthOwners(registry.truthOwners ?? [], "registry");
}

function checkContractTruthOwners() {
  const ownersByFact = new Map((contract.truthOwners ?? []).map((item) => [item.factId, item]));
  for (const factId of requiredChain) {
    if (!ownersByFact.has(factId)) fail("truth_matrix.contract_fact_missing", `${contractPath} missing ${factId}.`);
  }
  const amountBasisProposal = ownersByFact.get("AmountBasisProposal");
  if (amountBasisProposal?.owner !== "BusinessDomainPack") {
    fail("truth_matrix.amount_proposal_owner", "AmountBasisProposal must be business-domain proposal only.");
  }
  for (const factId of ["AmountBasisReviewed", "AmountBasis", "FinancialFact"]) {
    if (ownersByFact.get(factId)?.owner !== "FinanceTruthPack") {
      fail("truth_matrix.finance_owner", `${factId} must be owned by FinanceTruthPack.`);
    }
  }
  for (const factId of ["LedgerTransaction", "LedgerEntry"]) {
    if (ownersByFact.get(factId)?.owner !== "MoneyKernelPack") {
      fail("truth_matrix.ledger_owner", `${factId} must be owned by MoneyKernelPack.`);
    }
  }
  for (const fact of ownersByFact.values()) {
    for (const owner of readSideForbiddenOwners) {
      if (!(fact.forbiddenOwners ?? []).includes(owner)) {
        fail("truth_matrix.read_side_forbidden_missing", `${fact.factId} must forbid ${owner}.`);
      }
    }
  }
}

function checkReadSideWriters() {
  for (const owner of readSideForbiddenOwners) {
    if (!(contract.readSideWritersForbiddenOwners ?? []).includes(owner)) {
      fail("truth_matrix.read_side_writer_missing", `Read side writer ${owner} must be forbidden.`);
    }
  }
}

function checkEvidenceObjectPolicy() {
  const policy = contract.evidenceObjectPolicy ?? {};
  if (policy.factId !== "EvidenceObject" || policy.proofOnly !== true || policy.definesBusinessFactAllowed !== false) {
    fail("truth_matrix.evidence_object_policy", "EvidenceObject must prove only and must not define business facts.");
  }
  for (const owner of readSideForbiddenOwners) {
    if (!(policy.forbiddenOwners ?? []).includes(owner)) {
      fail("truth_matrix.evidence_read_side_forbidden", `EvidenceObject must forbid ${owner}.`);
    }
  }
}

function checkFinanceWritePolicy() {
  const ownersByFact = new Map((contract.truthOwners ?? []).map((item) => [item.factId, item]));
  if (contract.businessDomainFinancialFactWriteAllowed !== false || contract.businessDomainLedgerEntryWriteAllowed !== false) {
    fail("truth_matrix.business_finance_write", "Business domains must not write FinancialFact or LedgerEntry.");
  }
  const financialFact = ownersByFact.get("FinancialFact");
  if (JSON.stringify(financialFact?.allowedCommitters) !== JSON.stringify(["FinanceTruthPack"])) {
    fail("truth_matrix.financial_fact_committer", "FinancialFact can only be committed by FinanceTruthPack.");
  }
  const ledgerEntry = ownersByFact.get("LedgerEntry");
  if (JSON.stringify(ledgerEntry?.allowedCommitters) !== JSON.stringify(["MoneyKernelPack"])) {
    fail("truth_matrix.ledger_entry_committer", "LedgerEntry can only be committed by MoneyKernelPack.");
  }
}

function checkNegativeFixtures() {
  const ownersByFact = new Map((contract.truthOwners ?? []).map((item) => [item.factId, item]));
  for (const fixture of contract.negativeFixtures ?? []) {
    const target = ownersByFact.get(fixture.targetFactId);
    if (!target) {
      fail("truth_matrix.negative_target_missing", `${fixture.fixtureId} target ${fixture.targetFactId} missing from contract truthOwners.`);
      continue;
    }
    const isForbidden = (target.forbiddenOwners ?? []).includes(fixture.actor);
    if (fixture.expected !== "fail" || fixture.severity !== "P0" || !isForbidden) {
      fail("truth_matrix.negative_fixture_failed", `${fixture.fixtureId} must prove forbidden owner write fails as P0.`);
    }
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function requirePath(file, label) {
  if (!file || !fs.existsSync(path.join(root, file))) fail("truth_matrix.path_missing", `${label} references missing path: ${file}`);
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeResult() {
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify({
    version: "workosnext.authority.truth-ownership-matrix-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}

function writeProof() {
  fs.mkdirSync(path.dirname(path.join(root, proofPath)), { recursive: true });
  fs.writeFileSync(path.join(root, proofPath), `${JSON.stringify({
    version: "workosnext.authority.truth-ownership-proof.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    severityOnConflict: "P0",
    proves: [
      "Every factId in the matrix has exactly one truth owner.",
      "Every factId in the matrix has allowedCommitters and forbiddenOwners.",
      "Search, Surface, Dashboard, Report, and Metric cannot write business facts.",
      "FinancialFact can only be committed by FinanceTruthPack and LedgerEntry can only be committed by MoneyKernelPack.",
      "EvidenceObject proves facts but does not define business facts.",
      "Business domains cannot write FinancialFact or LedgerEntry.",
      "Forbidden owner negative fixtures fail as P0."
    ],
    financeStateChain: requiredChain,
    negativeFixtures: contract.negativeFixtures ?? [],
    proofRefs: {
      contract: contractPath,
      schema: schemaPath,
      registry: registryPath
    },
    violations
  }, null, 2)}\n`);
}
