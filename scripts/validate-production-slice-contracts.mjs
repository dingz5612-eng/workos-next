import fs from "node:fs";

const manifest = readJson("docs/contracts/production-slice-manifest.json");
const surfacePolicy = readJson("docs/contracts/runtime-surface-policy.json");
const lensContract = readJson("docs/contracts/accommodation-lens-contract.json");
const failures = [];
const forbiddenCapabilityIds = new Set(["Dormitory.FirstGoldenChain"]);
const requiredSlices = [
  "Accommodation.ResourceSetup",
  "Accommodation.CheckIn",
  "Accommodation.CheckOutSettlement",
  "Accommodation.DepositLedger",
  "Accommodation.PaymentLedger",
  "Accommodation.ServiceTask",
  "Accommodation.PeriodAnalytics"
];
const sliceIds = new Set((manifest.slices ?? []).map((slice) => slice.id));
const policiesBySlice = new Map((surfacePolicy.policies ?? []).map((policy) => [policy.sliceId, policy]));
const lensIds = new Set((lensContract.lenses ?? []).map((lens) => lens.id));

requireEqual(manifest.version, "workos.production-slice-manifest.v1", "manifest.version");
requireEqual(manifest.manifestMode, "production_slice_only", "manifest.manifestMode");

for (const required of requiredSlices) {
  if (!sliceIds.has(required)) failures.push(`Production slice manifest missing ${required}.`);
}

for (const slice of manifest.slices ?? []) {
  if (forbiddenCapabilityIds.has(slice.id)) failures.push(`${slice.id} must not be validated as a production slice.`);
  requireEqual(slice.status, "production-slice", `${slice.id}.status`);
  for (const field of ["workspaceId", "cards", "events", "ownsAggregates"]) {
    if (!slice[field] || (Array.isArray(slice[field]) && slice[field].length === 0)) {
      failures.push(`Production slice ${slice.id} missing ${field}.`);
    }
  }
  const policy = policiesBySlice.get(slice.id);
  if (!policy) {
    failures.push(`Production slice ${slice.id} missing RuntimeSurfacePolicy.`);
    continue;
  }
  requireEqual(policy.workspaceId, slice.workspaceId, `${slice.id}.RuntimeSurfacePolicy.workspaceId`);
  if (!policy.defaultLens || !(policy.lenses ?? []).includes(policy.defaultLens)) {
    failures.push(`Production slice ${slice.id} must declare a default lens in RuntimeSurfacePolicy.`);
  }
  for (const lens of policy.lenses ?? []) {
    if (!lensIds.has(lens) && !["bed-inventory", "room-readiness", "rate-plan", "today-operations", "active-stay", "deposit-liability", "stay-balance", "expense-analytics"].includes(lens)) {
      failures.push(`Production slice ${slice.id} references unknown lens ${lens}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Production slice contract validation: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production slice contract validation: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
