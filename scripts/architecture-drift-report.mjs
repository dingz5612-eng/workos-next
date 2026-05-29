import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const rulesIndex = JSON.parse(fs.readFileSync("docs/architecture/rules/index.json", "utf8"));
const exceptions = JSON.parse(fs.readFileSync("docs/architecture/architecture-exceptions.json", "utf8"));

const policySliceIds = new Set((surfacePolicy.policies || []).map((policy) => policy.sliceId));
const productionSlices = (manifest.slices || []).filter((slice) => slice.status === "production-slice");
const contractOnlySlices = (manifest.slices || []).filter((slice) => slice.status === "contract-only");
const missingSurfacePolicies = productionSlices
  .filter((slice) => !policySliceIds.has(slice.id))
  .map((slice) => slice.id);
const activeExceptions = (exceptions.exceptions || [])
  .filter((item) => Date.parse(item.expiresAt) >= Date.now())
  .map((item) => item.ruleId);
const expiredExceptions = (exceptions.exceptions || [])
  .filter((item) => Date.parse(item.expiresAt) < Date.now())
  .map((item) => item.ruleId);

const report = {
  generatedAtUtc: new Date().toISOString(),
  manifestVersion: manifest.version,
  surfacePolicyVersion: surfacePolicy.version,
  productionSliceCount: productionSlices.length,
  contractOnlySliceCount: contractOnlySlices.length,
  surfaceCoverageMissingCount: missingSurfacePolicies.length,
  missingSurfacePolicies,
  lensContractCount: (lensContract.lenses || []).length,
  ruleCount: (rulesIndex.rules || []).length,
  activeArchitectureExceptions: activeExceptions,
  expiredArchitectureExceptions: expiredExceptions
};

console.log("Architecture drift summary:");
console.log(JSON.stringify(report, null, 2));

if (missingSurfacePolicies.length > 0) {
  throw new Error(`Missing production surface policies: ${missingSurfacePolicies.join(", ")}`);
}

if (expiredExceptions.length > 0) {
  throw new Error(`Expired architecture exceptions: ${expiredExceptions.join(", ")}`);
}
