import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const graphPath = "docs/oam/lodging-consumer-graph.json";
const resultPath = "artifacts/oam/checks/lodging-consumer-graph-result.json";
const failures = [];
const graph = readJson(graphPath, root);

if (graph.version !== "oam.lodging-consumer-graph.v1") fail("graph.version mismatch.");
if (graph.status !== "authoritative") fail("graph.status must be authoritative.");
if (graph.hardBoundaries?.unregisteredConsumerAllowed !== false) fail("unregistered consumers must be forbidden.");
if (graph.hardBoundaries?.firstGoldenChainAsCurrentBusinessEntryAllowed !== false) fail("FirstGoldenChain current business entry must be forbidden.");
if (graph.hardBoundaries?.wStayResourceAsCurrentSeedAllowed !== false) fail("W-STAY-RESOURCE current seed must be forbidden.");
if (graph.hardBoundaries?.browserAuditMayUseFirstGoldenChainAsCurrentMainAudit !== false) fail("browser current main audit must not use FirstGoldenChain.");
if (graph.hardBoundaries?.evidenceRootMayBindOnlyLegacyEvidence !== false) fail("Evidence Root must not bind only legacy evidence.");

const consumers = graph.consumers ?? [];
const consumerIds = new Set(consumers.map((item) => item.consumerId));
for (const required of graph.requiredConsumers ?? []) {
  if (!consumerIds.has(required)) fail(`required consumer missing: ${required}.`);
}

const generatedRefs = [];
for (const consumer of consumers) {
  if (!consumer.consumerId) fail("consumer.consumerId is required.");
  if (!consumer.blockingGate) fail(`${consumer.consumerId} missing blockingGate.`);
  if (!Array.isArray(consumer.verificationScripts) || consumer.verificationScripts.length === 0) {
    fail(`${consumer.consumerId} missing verificationScripts.`);
  }
  if (!Array.isArray(consumer.ownedPathPrefixes) || consumer.ownedPathPrefixes.length === 0) {
    fail(`${consumer.consumerId} missing ownedPathPrefixes.`);
  }
  if (consumer.currentMainAudit === true && consumer.legacyAllowed === true) {
    fail(`${consumer.consumerId} cannot be both currentMainAudit and legacyAllowed.`);
  }
  if (consumer.legacyAllowed === true && consumer.legacyReadonly !== true) {
    fail(`${consumer.consumerId} allows legacy but does not mark legacyReadonly.`);
  }
  for (const ref of consumer.generatedContractRefs ?? []) {
    if (!fs.existsSync(path.join(root, ref))) fail(`${consumer.consumerId} generated contract missing: ${ref}.`);
    else generatedRefs.push({ consumerId: consumer.consumerId, path: ref, digest: fileDigest(ref, root) });
  }
}

const result = {
  version: "oam.lodging-consumer-graph-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  graphPath,
  graphDigest: fileDigest(graphPath, root),
  consumerCount: consumers.length,
  requiredConsumers: graph.requiredConsumers ?? [],
  generatedRefs,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Lodging consumer graph check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lodging consumer graph check: PASS (${consumers.length} consumers)`);

function fail(message) {
  failures.push(message);
}
