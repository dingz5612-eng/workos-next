import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { operationFieldId, canonicalTaskFieldId } from "../apps/mobile/src/operationFieldKernel.js";
import { contextContractSummary, stepContextContract } from "../apps/mobile/src/systemContextContract.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const dormitoryWorkspaceIds = new Set([
  "W-STAY-RESOURCE",
  "W-STAY-CHECKIN",
  "W-STAY-LEAD-RESERVATION",
  "W-STAY-LIFECYCLE",
  "W-STAY-DEPOSIT-LEDGER",
  "W-STAY-PAYMENT-LEDGER",
  "W-STAY-CHECKOUT-SETTLEMENT",
  "W-STAY-SERVICE-TASK",
  "W-STAY-EXPENSE-LEDGER",
  "W-STAY-PERIOD-ANALYTICS"
]);

const forbiddenRetiredFieldIds = new Set([
  "depositRule",
  "varianceReason",
  "actualCost",
  "releaseScope",
  "assigneeId"
]);

const protectedFieldIds = new Set([
  "leadId",
  "reservationId",
  "residentId",
  "roomId",
  "bedId",
  "stayId",
  "folioId",
  "chargeId",
  "depositId",
  "depositReceiptId",
  "paymentId",
  "taskId",
  "expenseId",
  "checkoutId",
  "periodId",
  "actionPlanId",
  "operatorId",
  "receivedBy",
  "financeReviewer",
  "managerId",
  "approverId",
  "confirmer",
  "payerId",
  "payerName",
  "reviewerId",
  "ownerName",
  "ownerActorId"
]);

const seedCards = extractDormitorySeedCards();
const backendAliases = extractRuntimeFieldAliases();
const stepDependencyContract = readJson("docs/contracts/definition/step-dependency-contract.json");
const fieldContractRefs = readJson("docs/contracts/definition/field-contract-refs.json");

checkSeedCoverage();
checkRuntimeFrontendAliasAlignment();
checkBusinessFieldsDeclaredByContextContract();
checkContextSubmittedFieldsAllowedBySeed();
checkInheritedFieldsProducedByDependencies();
checkDefinitionDocsAligned();

writeReport();

if (failures.length) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  throw new Error("Dormitory field context contract check failed.");
}

console.log("Dormitory field context contracts check: PASS");

function checkSeedCoverage() {
  if (seedCards.length !== 58) {
    failures.push(`Expected 58 active dormitory seed cards across 10 scenarios, found ${seedCards.length}.`);
  }
  const workspaceIds = new Set(seedCards.map((card) => card.workspaceId));
  for (const workspaceId of dormitoryWorkspaceIds) {
    if (!workspaceIds.has(workspaceId)) failures.push(`Missing dormitory seed workspace ${workspaceId}.`);
  }
}

function checkRuntimeFrontendAliasAlignment() {
  for (const card of seedCards) {
    for (const systemFieldId of card.systemFieldIds) {
      if (hasCjk(systemFieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId} system field must be canonical ASCII, found ${systemFieldId}.`);
      }
    }
    for (const label of card.businessLabels) {
      const backendFieldId = backendAliases.get(label);
      if (!backendFieldId) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} is missing RuntimeFieldAliases canonical mapping.`);
        continue;
      }
      const frontendFallback = operationFieldId({ label: { "zh-CN": label } });
      if (frontendFallback !== backendFieldId) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} frontend label fallback maps to ${frontendFallback || "<empty>"} but backend maps to ${backendFieldId}.`);
      }
      const stableId = operationFieldId({ id: backendFieldId, label: { "zh-CN": label } });
      if (stableId !== backendFieldId) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} frontend stable id was rewritten to ${stableId}; expected ${backendFieldId}.`);
      }
      const taskFieldId = canonicalTaskFieldId({ id: backendFieldId, label: { "zh-CN": label } });
      if (taskFieldId !== backendFieldId) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} task field canonical id maps to ${taskFieldId || "<empty>"} but expected ${backendFieldId}.`);
      }
      if (hasCjk(frontendFallback) || hasCjk(taskFieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} produced localized field id.`);
      }
    }
  }
}

function checkBusinessFieldsDeclaredByContextContract() {
  for (const card of seedCards) {
    const contract = stepContextContract(card.cardId);
    if (!contract) {
      failures.push(`${card.workspaceId}.${card.cardId} is missing systemContextContract.`);
      continue;
    }
    const summary = contextContractSummary(card.cardId);
    const declared = new Set([
      ...summary.inherited,
      ...summary.user,
      ...summary.derived,
      ...summary.backend,
      ...summary.retired
    ]);
    for (const label of card.businessLabels) {
      const fieldId = backendAliases.get(label) || operationFieldId({ label: { "zh-CN": label } });
      if (!declared.has(fieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId}.${label} -> ${fieldId} must be declared inherited, user, derived, backend, or retired in systemContextContract.`);
      }
    }
    for (const fieldId of [...declared]) {
      if (hasCjk(fieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId} context contract contains localized field id ${fieldId}.`);
      }
    }
  }
}

function checkContextSubmittedFieldsAllowedBySeed() {
  for (const card of seedCards) {
    const summary = contextContractSummary(card.cardId);
    const businessFieldIds = new Set(card.businessLabels
      .map((label) => backendAliases.get(label) || operationFieldId({ label: { "zh-CN": label } })));
    const allowed = new Set([...card.systemFieldIds, ...businessFieldIds]);
    const clientSubmittedContextFields = [
      ...summary.inherited,
      ...summary.derived
    ];
    for (const fieldId of clientSubmittedContextFields) {
      if (!allowed.has(fieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId} submits context field ${fieldId}, but WorkspaceSeedCatalog field contract does not allow it as system or business field.`);
      }
    }
  }
}

function checkInheritedFieldsProducedByDependencies() {
  const activeCardIds = new Set(seedCards.map((card) => card.cardId));
  const producedByCard = new Map(seedCards.map((card) => {
    const contract = stepContextContract(card.cardId);
    const summary = contextContractSummary(card.cardId);
    return [card.cardId, new Set([
      ...summary.inherited,
      ...summary.user,
      ...summary.derived,
      ...summary.backend
    ])];
  }));
  for (const card of seedCards) {
    const contract = stepContextContract(card.cardId);
    const dependencies = (contract?.dependsOn || []).filter((dependency) => activeCardIds.has(dependency));
    const dependencyOutput = new Set(dependencies.flatMap((dependency) => [...(producedByCard.get(dependency) || new Set())]));
    for (const inherited of contract?.inheritedFields || []) {
      if (inherited.sourceWorkItemId === "operations-start-context") continue;
      if (!dependencies.length) continue;
      if (!dependencyOutput.has(inherited.fieldId)) {
        failures.push(`${card.workspaceId}.${card.cardId} inherits ${inherited.fieldId}, but active dependencies ${dependencies.join(",")} do not produce or carry it.`);
      }
    }
  }
}

function checkDefinitionDocsAligned() {
  const docContracts = new Map((stepDependencyContract.contracts || []).map((item) => [item.workItemId, item]));
  for (const card of seedCards) {
    const docContract = docContracts.get(card.cardId);
    if (!docContract) {
      failures.push(`step-dependency-contract.json missing ${card.cardId}.`);
      continue;
    }
    const summary = contextContractSummary(card.cardId);
    for (const [bucket, expected] of Object.entries({
      inheritedFields: summary.inherited,
      userSelectableFields: summary.user,
      derivedFields: summary.derived,
      backendDefaultFields: summary.backend,
      retiredFields: summary.retired
    })) {
      const actual = new Set((docContract[bucket] || []).map((item) => item.fieldId));
      for (const fieldId of expected) {
        if (!actual.has(fieldId)) {
          failures.push(`step-dependency-contract.json ${card.cardId}.${bucket} missing ${fieldId}.`);
        }
      }
    }
  }

  const allDocFieldIds = [
    ...(stepDependencyContract.contracts || []).flatMap((contract) => [
      ...(contract.inheritedFields || []),
      ...(contract.userSelectableFields || []),
      ...(contract.derivedFields || []),
      ...(contract.backendDefaultFields || []),
      ...(contract.hiddenBackendDefaults || []),
      ...(contract.retiredFields || [])
    ].map((item) => item.fieldId)),
    ...(fieldContractRefs.refs || []).flatMap((ref) => [
      ...(ref.requiredFieldIds || []),
      ...(ref.optionalFieldIds || [])
    ])
  ];
  for (const fieldId of allDocFieldIds) {
    if (forbiddenRetiredFieldIds.has(fieldId)) {
      failures.push(`Definition docs still contain retired field id ${fieldId}; use the canonical current field id.`);
    }
  }

  const guardPolicy = stepDependencyContract.guardPolicy || {};
  const guardProtected = new Set([
    ...(guardPolicy.objectReferenceFieldIds || []),
    ...(guardPolicy.actorFieldIds || [])
  ]);
  for (const fieldId of protectedFieldIds) {
    if (!guardProtected.has(fieldId)) {
      failures.push(`step-dependency-contract guardPolicy must include protected field ${fieldId}.`);
    }
  }
}

function extractDormitorySeedCards() {
  const source = readText("services/core-api/WorkOS.Api/Runtime/WorkspaceSeedCatalog.cs");
  const cards = [];
  let workspaceId = "";
  for (const line of source.split(/\r?\n/)) {
    const workspaceMatch = line.match(/Workspace\("([^"]+)"/);
    if (workspaceMatch) workspaceId = workspaceMatch[1];
    const cardMatch = line.match(/Card\("([^"]+)"/);
    if (!cardMatch || !dormitoryWorkspaceIds.has(workspaceId)) continue;
    const arrays = [...line.matchAll(/new\[\]\s*\{([^}]*)\}/g)]
      .map((match) => [...match[1].matchAll(/"([^"]*)"/g)].map((item) => item[1]));
    cards.push({
      workspaceId,
      cardId: cardMatch[1],
      systemFieldIds: arrays[0] || [],
      businessLabels: arrays[1] || []
    });
  }
  return cards;
}

function extractRuntimeFieldAliases() {
  const source = readText("services/core-api/WorkOS.Api/Runtime/RuntimeFieldAliases.cs");
  const fieldAliasesSection = source.slice(
    source.indexOf("FieldAliases ="),
    source.indexOf("private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> OptionAliases")
  );
  return new Map([...fieldAliasesSection.matchAll(/\["([^"]+)"\]\s*=\s*"([^"]+)"/g)]
    .map((match) => [match[1], match[2]]));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function writeReport() {
  const outputPath = path.join(root, "artifacts/oam/checks/dormitory-field-context-contract-result.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    status: failures.length ? "failed" : "passed",
    generatedAtUtc: new Date().toISOString(),
    checkedWorkspaces: [...dormitoryWorkspaceIds],
    checkedCardCount: seedCards.length,
    protectedFieldIds: [...protectedFieldIds],
    forbiddenRetiredFieldIds: [...forbiddenRetiredFieldIds],
    failures
  }, null, 2));
}
