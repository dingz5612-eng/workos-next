import fs from "node:fs";
import path from "node:path";
import { validateReplayResult } from "./run-dormitory-live-api-db-scenarios.mjs";

const root = process.cwd();
const resultPath = readArg("--result=", "artifacts/go-live/dormitory/live-api-db-replay-result.json");
const contractPath = readArg("--contract=", "docs/go-live/dormitory/runtime-replay-contract.yml");
const result = JSON.parse(fs.readFileSync(path.join(root, resultPath), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(root, contractPath), "utf8"));
const noGoItems = [...(result.noGoItems ?? []), ...validateReplayResult(result)];

for (const ref of result.artifactsGenerated ?? []) {
  if (String(ref).startsWith(".tmp/") || String(ref).includes("/.tmp/")) {
    noGoItems.push({ severity: "P0", id: "d1.tmp_artifact_forbidden", message: "D1 final artifact 不允许使用 .tmp ref。", ref });
  }
}

if (result.status !== "passed") {
  noGoItems.push({ severity: "P0", id: "d1.result_not_passed", message: "D1 replay result status 必须是 passed。", status: result.status });
}

for (const required of contract.apiCallsRequired ?? []) {
  const [method, route] = required.split(" ");
  if (!(result.apiCallsExecuted ?? []).some((item) => item.method === method && (item.contractPath === route || item.path === route))) {
    noGoItems.push({ severity: "P0", id: "d1.required_api_not_executed", message: `未执行必需 API: ${required}`, required });
  }
}

for (const required of contract.dbAssertionsRequired ?? []) {
  if (!(result.dbAssertions ?? []).some((item) => item.name === required && item.status === "passed")) {
    noGoItems.push({ severity: "P0", id: "d1.required_db_assertion_not_passed", message: `DB assertion 未通过: ${required}`, required });
  }
}

if (noGoItems.length) {
  for (const item of noGoItems) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("Dormitory runtime replay result: BLOCKED");
}

console.log("Dormitory runtime replay result: PASS");

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
