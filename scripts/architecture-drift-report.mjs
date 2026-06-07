import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const oamContract = JSON.parse(fs.readFileSync("docs/contracts/oam.current.json", "utf8"));
const exceptions = JSON.parse(fs.readFileSync("docs/oam/current-architecture-exceptions.json", "utf8"));

const policySliceIds = new Set((surfacePolicy.policies || []).map((policy) => policy.sliceId));
const manifestSliceIds = new Set((manifest.slices || []).map((slice) => slice.id));
const productionSlices = (manifest.slices || []).filter((slice) => slice.status === "production-slice");
const historicalRuntimeSlices = (manifest.slices || []).filter((slice) => slice.status !== "production-slice");
const missingSurfacePolicies = productionSlices
  .filter((slice) => !policySliceIds.has(slice.id))
  .map((slice) => slice.id);
const extraSurfacePolicies = (surfacePolicy.policies || [])
  .filter((policy) => !manifestSliceIds.has(policy.sliceId))
  .map((policy) => policy.sliceId);
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
  historicalRuntimeSliceCount: historicalRuntimeSlices.length,
  historicalRuntimeSlices: historicalRuntimeSlices.map((slice) => `${slice.id}:${slice.status}`),
  surfaceCoverageMissingCount: missingSurfacePolicies.length,
  missingSurfacePolicies,
  extraSurfacePolicyCount: extraSurfacePolicies.length,
  extraSurfacePolicies,
  lensContractCount: (lensContract.lenses || []).length,
  productCapabilityCount: (oamContract.productCapabilities || []).length,
  activeArchitectureExceptions: activeExceptions,
  expiredArchitectureExceptions: expiredExceptions
};

console.log("Architecture drift summary:");
console.log(JSON.stringify(report, null, 2));

if (missingSurfacePolicies.length > 0) {
  throw new Error(`Missing production surface policies: ${missingSurfacePolicies.join(", ")}`);
}

if (extraSurfacePolicies.length > 0) {
  throw new Error(`Runtime surface policies outside current manifest: ${extraSurfacePolicies.join(", ")}`);
}

if (historicalRuntimeSlices.length > 0) {
  throw new Error(`Historical runtime slices must be removed: ${historicalRuntimeSlices.map((slice) => `${slice.id}:${slice.status}`).join(", ")}`);
}

if (expiredExceptions.length > 0) {
  throw new Error(`Expired architecture exceptions: ${expiredExceptions.join(", ")}`);
}
