import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kitRoot = path.join(root, "docs/business/domain-kit");
const admissionRoot = path.join(root, "docs/business/admission");
const requiredTemplates = [
  "domain-template.yml",
  "fact-ownership-template.yml",
  "workitem-template.yml",
  "action-protocol-template.yml",
  "evidence-template.yml",
  "finance-template.yml",
  "lens-template.yml",
  "risk-template.yml",
  "surface-template.yml",
  "raci-template.yml",
  "certification-template.yml",
  "training-template.yml",
  "go-no-go-template.yml"
];

for (const file of requiredTemplates) {
  assert(fs.existsSync(path.join(kitRoot, file)), `Missing Domain Kit template: ${file}`);
  JSON.parse(fs.readFileSync(path.join(kitRoot, file), "utf8"));
}

const readme = fs.readFileSync(path.join(kitRoot, "README.md"), "utf8");
assert(readme.includes("Dormitory Golden Domain"), "Domain Kit README must say it is derived from Dormitory Golden Domain");
assert(readme.includes("productionAllowed=false"), "Domain Kit README must keep L0 production disabled");

const domain = readKit("domain-template.yml");
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
  assert(domain.requiredSections.includes(section), `Domain template missing section ${section}`);
}
assert(domain.productionAllowedDefault === false, "Domain template must default productionAllowed=false");

assert(readKit("fact-ownership-template.yml").nonOwnerDirectWriteAllowed === false, "Fact Ownership Kit must block non-owner direct writes");
assert(readKit("action-protocol-template.yml").mustUseCommandSubmission === true, "Action Protocol Kit must require CommandSubmission");
assert(readKit("surface-template.yml").mobileBffWritesFacts === false, "Surface Kit must keep Mobile BFF read/submit only");
assert(readKit("training-template.yml").mustMapToCertification === true, "Training Kit must map to certification");

for (const file of fs.readdirSync(admissionRoot).filter(file => file.endsWith("-l0-admission.yml"))) {
  const admission = JSON.parse(fs.readFileSync(path.join(admissionRoot, file), "utf8"));
  assert(admission.productionAllowed === false, `${file} must not enable production`);
  assert((admission.productionWriteRoutes ?? []).length === 0, `${file} must not expose production write routes`);
}

console.log("Domain Kit usage check: PASS");

function readKit(file) {
  return JSON.parse(fs.readFileSync(path.join(kitRoot, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
