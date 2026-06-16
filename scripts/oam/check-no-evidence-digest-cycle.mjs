import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/no-evidence-digest-cycle-result.json";
const subjectChainPath = "artifacts/oam/evidence/capability-evidence-subject-chain.json";
const digestChainPath = "artifacts/oam/evidence/capability-digest-chain.json";
const failures = [];
const subjectChain = readJson(subjectChainPath);
const digestChain = readJson(digestChainPath);

if (subjectChain) {
  if (findKeys(subjectChain, "evidenceRootDigest").length > 0) {
    fail("capability evidence subject chain must not contain evidenceRootDigest.");
  }
  if (!isDigest(subjectChain.outputContentDigest)) fail("subject chain outputContentDigest must be a sha256 digest.");
  const expectedDigest = stableDigest({ ...subjectChain, outputContentDigest: "sha256:pending" });
  if (subjectChain.outputContentDigest !== expectedDigest) fail("subject chain outputContentDigest mismatch.");
  const selfRefs = findValues(subjectChain, subjectChain.outputContentDigest).filter((item) => item !== "outputContentDigest");
  if (selfRefs.length > 0) fail(`subject chain must not contain its own digest outside outputContentDigest: ${selfRefs.join(", ")}.`);
  if ("subjectChainDigest" in subjectChain) fail("subject chain must not bind itself through subjectChainDigest.");
}
if (subjectChain && digestChain) {
  if (digestChain.subjectChainRef !== subjectChainPath) fail("capability digest chain must bind subject chain ref.");
  if (digestChain.subjectChainDigest !== subjectChain.outputContentDigest) fail("capability digest chain subjectChainDigest must match subject chain outputContentDigest.");
  if (!isDigest(digestChain.subjectChainDigest)) fail("capability digest chain subjectChainDigest must be a sha256 digest.");
}

writeResult({
  version: "oam.no-evidence-digest-cycle-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  subjectChainPath,
  digestChainPath,
  evidenceRootBindingField: "subjectChainDigest",
  forbiddenSubjectField: "evidenceRootDigest",
  failures
});

if (failures.length) {
  console.error("No evidence digest cycle check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("No evidence digest cycle check: PASS");

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`${file} is missing.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function findKeys(value, key, currentPath = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findKeys(item, key, `${currentPath}[${index}]`));
  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    const nextPath = currentPath ? `${currentPath}.${entryKey}` : entryKey;
    return [
      ...(entryKey === key ? [nextPath] : []),
      ...findKeys(entryValue, key, nextPath)
    ];
  });
}

function findValues(value, expected, currentPath = "") {
  if (value === expected) return [currentPath];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findValues(item, expected, `${currentPath}[${index}]`));
  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    const nextPath = currentPath ? `${currentPath}.${entryKey}` : entryKey;
    return findValues(entryValue, expected, nextPath);
  });
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function stableDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value ?? ""));
}

function fail(message) {
  failures.push(message);
}
