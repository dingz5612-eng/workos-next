import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kitRoot = path.join(root, "docs/business/domain-kit");
const templates = [
  "domain-template.yml",
  "workitem-template.yml",
  "evidence-template.yml",
  "finance-template.yml",
  "lens-template.yml",
  "risk-template.yml",
  "certification-template.yml",
  "go-no-go-template.yml"
];

for (const file of templates) {
  assert(fs.existsSync(path.join(kitRoot, file)), `Missing Business Domain Kit template: ${file}`);
}

const domain = readTemplate("domain-template.yml");
for (const section of [
  "domainObjects",
  "factOwnership",
  "workItemCatalog",
  "actionProtocol",
  "evidencePolicy",
  "ledgerMoneyPolicy",
  "lensMetrics",
  "riskException",
  "surfaceContract",
  "raciShift",
  "certificationPack",
  "trainingLearning",
  "goNoGo"
]) {
  assert((domain.requiredSections ?? []).includes(section), `Domain template missing section ${section}`);
}
assert(domain.productionAllowedDefault === false, "Domain template must default productionAllowed to false");

const workItem = readTemplate("workitem-template.yml");
for (const field of ["workItemType", "ownerRole", "SLA", "requiredEvidence", "affectedFacts", "ledgerImpact", "factTraceRequired"]) {
  assert((workItem.requiredFields ?? []).includes(field), `WorkItem template missing ${field}`);
}
assert(workItem.notFactSource === "WorkItemBundle", "WorkItem template must keep WorkItemBundle out of fact source");

const evidence = readTemplate("evidence-template.yml");
for (const binding of ["tenantId", "caseId", "workItemId", "submissionId", "evidenceHash"]) {
  assert((evidence.bindingRules ?? []).includes(binding), `Evidence template missing binding ${binding}`);
}
assert(evidence.missingEvidenceBlocksConfirm === true, "Evidence template must block missing evidence");

const finance = readTemplate("finance-template.yml");
const financeText = JSON.stringify(finance).toLowerCase();
assert(financeText.includes("balanced ledgertransaction"), "Finance template must require balanced LedgerTransaction");
assert(financeText.includes("deposit liability not revenue"), "Finance template must protect deposit liability");

const lens = readTemplate("lens-template.yml");
assert(lens.projectionNotFactSource === true, "Lens template must state projection is not fact source");

const risk = readTemplate("risk-template.yml");
for (const code of ["403", "409", "422"]) {
  assert(JSON.stringify(risk).includes(code), `Risk template missing ${code}`);
}

const certification = readTemplate("certification-template.yml");
assert(certification.replayable === true, "Certification template must require replayable scenarios");
for (const field of ["scenarioId", "submissionId", "factTrace", "semanticShadowResult", "cutoverState", "rollbackOrCompensationPath"]) {
  assert((certification.requiredFields ?? []).includes(field), `Certification template missing ${field}`);
}

const goNoGo = readTemplate("go-no-go-template.yml");
assert(goNoGo.productionAllowedDefault === false, "Go/No-Go template must default productionAllowed to false");

console.log("Business Domain Kit check: PASS");

function readTemplate(file) {
  return JSON.parse(fs.readFileSync(path.join(kitRoot, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
