import fs from "node:fs";
import path from "node:path";
import { validateRuntimeProofResult } from "./run-runtime-proof.mjs";

const root = process.cwd();
const resultPath = readArg("--result=", "artifacts/proof/runtime-proof-result.json");
const dormitoryResultPath = readArg("--dormitory-result=", "artifacts/go-live/dormitory/runtime-proof-result.json");
const contractPath = readArg("--contract=", "docs/proof/runtime-proof-contract.yml");

const result = readJson(resultPath);
const dormitory = readJson(dormitoryResultPath);
const contract = readJson(contractPath);
const noGoItems = [
  ...(result.noGoItems ?? []),
  ...validateRuntimeProofResult(result, contract)
];

if (dormitory.status !== "passed") {
  noGoItems.push(violation("oam03.dormitory_runtime_proof_not_passed", "宿舍 runtime proof artifact 必须是 passed。", { status: dormitory.status }));
}

if (dormitory.sourceMode !== "live_api_db") {
  noGoItems.push(violation("oam03.dormitory_source_mode_not_live_api_db", "宿舍 runtime proof sourceMode 必须是 live_api_db。"));
}

if ((result.evidenceRefs ?? []).some((ref) => String(ref).includes(".tmp"))) {
  noGoItems.push(violation("oam03.tmp_ref_forbidden", "OAM-03 evidence refs 不允许包含 .tmp。"));
}

if (noGoItems.length) {
  for (const item of noGoItems) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("OAM-03 runtime proof result: BLOCKED");
}

console.log("OAM-03 runtime proof result: PASS");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
