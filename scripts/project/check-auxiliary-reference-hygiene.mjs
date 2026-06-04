import fs from "node:fs";
import path from "node:path";
import {
  exists,
  failIfNeeded,
  normalizePath,
  readJson,
  root,
  trackedFiles,
  updateProjectHygiene,
  writeJson
} from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const policy = readJson("docs/project/auxiliary-reference-policy.json");
const scanRoots = policy.scanRoots ?? ["docs", "scripts"];
const allowedMissingRefs = policy.allowedMissingRefs ?? [];
const ignoredOwners = new Set((policy.ignoredOwners ?? []).map(normalizePath));
const tracked = unique(scanRoots.flatMap((scanRoot) => trackedFiles(scanRoot)))
  .filter((file) => !ignoredOwners.has(file))
  .filter((file) => /\.(cs|js|mjs|ts|tsx|json|md|mdx|ps1|sh|sql|txt|ya?ml)$/i.test(file));

const refs = [];
for (const owner of tracked) {
  const text = fs.readFileSync(path.join(root, owner), "utf8");
  for (const ref of extractRepoRefs(text)) {
    refs.push({
      owner,
      ref,
      exists: refExists(ref),
      allowedMissing: false,
      classification: null,
      reason: null
    });
  }
}

for (const item of refs) {
  if (item.exists) continue;
  const allowance = findAllowance(item.owner, item.ref);
  if (!allowance) continue;
  item.allowedMissing = true;
  item.classification = allowance.classification ?? "allowed_missing";
  item.reason = allowance.reason ?? "";
}

const missingRefs = refs.filter((item) => !item.exists);
const unregisteredMissingRefs = missingRefs.filter((item) => !item.allowedMissing);
const noGoItems = unregisteredMissingRefs.map((item) => `${item.owner} 引用不存在且未登记的辅助路径：${item.ref}`);
const result = {
  generatedAtUtc,
  generatedBy: "check-auxiliary-reference-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  policyRef: "docs/project/auxiliary-reference-policy.json",
  scannedFileCount: tracked.length,
  repoReferenceCount: refs.length,
  missingReferenceCount: missingRefs.length,
  allowedMissingReferenceCount: missingRefs.length - unregisteredMissingRefs.length,
  unregisteredMissingReferenceCount: unregisteredMissingRefs.length,
  missingRefs,
  supersededHistoricalEvidence: policy.supersededHistoricalEvidence ?? [],
  currentAuthorityRefs: policy.currentAuthorityRefs ?? [],
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/auxiliary-reference-hygiene.json", result);
updateProjectHygiene("auxiliary_reference_hygiene", result);
failIfNeeded(noGoItems, "auxiliary reference hygiene check");
console.log("auxiliary reference hygiene check: PASS");

function extractRepoRefs(text) {
  const refs = new Set();
  const pattern = /(?:^|[\s"'`([{=:,])((?:\.\/)?(?:\.github|artifacts|docs|scripts|apps|tests|services|infra|schemas|tools)\/[A-Za-z0-9_./:@%+=,{}*?-]+\/?)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const ref = normalizeRef(match[1]);
    if (shouldKeepRef(ref)) refs.add(ref);
  }
  return Array.from(refs).sort();
}

function normalizeRef(value) {
  let ref = normalizePath(value)
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/#.*$/, "")
    .replace(/[)\]\}",.;]+$/g, "");
  ref = ref.replace(/:\d+(?::\d+)?$/, "");
  return ref;
}

function shouldKeepRef(ref) {
  if (!ref) return false;
  if (/[{}*?$<>]/.test(ref)) return false;
  if (ref.endsWith("-")) return false;
  if (ref.includes("node_modules/") || ref.includes("/bin/") || ref.includes("/obj/")) return false;
  if (ref.endsWith(":")) return false;
  return /^(?:\.github|artifacts|docs|scripts|apps|tests|services|infra|schemas|tools)\//.test(ref);
}

function refExists(ref) {
  if (exists(ref)) return true;
  const withoutTrailingSlash = ref.replace(/\/+$/, "");
  return withoutTrailingSlash !== ref && exists(withoutTrailingSlash);
}

function findAllowance(owner, ref) {
  return allowedMissingRefs.find((item) => matches(item.owner, item.ownerPattern, owner) && matches(item.ref, item.refPattern, ref));
}

function matches(exact, pattern, value) {
  if (exact && normalizePath(exact) !== value) return false;
  if (pattern && !new RegExp(pattern).test(value)) return false;
  return Boolean(exact || pattern);
}

function unique(values) {
  return Array.from(new Set(values.map(normalizePath))).sort();
}
