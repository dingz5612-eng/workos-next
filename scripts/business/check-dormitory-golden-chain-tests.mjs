import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = "artifacts/oam/checks/dormitory-golden-chain-tests-result.json";
const scenarioPath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const generatedWorkitemsPath = "docs/contracts/generated/dormitory/workitems.generated.json";
const definitionPath = "docs/contracts/definition/workitem-definition-registry.json";
const workflowPath = "docs/contracts/business/oam-workflow-state-registry.json";
const canonicalPath = "docs/business/dormitory/canonical-scenario-map.json";

const positiveChain = [
  ["Dorm.RoomSetupConfirm", "definition.dormitory.roomSetupConfirm.v1", "RoomSetup.Confirm"],
  ["Dorm.BedSetupConfirm", "definition.dormitory.bedSetupConfirm.v1", "BedSetup.Confirm"],
  ["Dorm.ResourceReadinessConfirm", "definition.dormitory.resourceReadinessConfirm.v1", "ResourceReadiness.Confirm"]
];
const violations = [];

const scenario = readText(scenarioPath);
const kernel = readJson(kernelPath);
const generatedWorkitems = readJson(generatedWorkitemsPath);
const definitions = readJson(definitionPath);
const workflows = readJson(workflowPath);
const canonical = readJson(canonicalPath);
const canonicalSource = readText("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const unitOfWorkSource = readText("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");
const dbProof = readJson("docs/oam/db-no-side-effects-proof.json");
const dashboardCheck = readText("scripts/oam/check-dashboard-readonly.mjs");
const searchCheck = readText("scripts/check-search-kernel.mjs");
const surfaceCheck = readText("scripts/oam/check-surface-language-v2.mjs");
const financeCheck = readText("scripts/finance/check-finance-semantic-truth.mjs");
const financeTruthCheck = readText("scripts/check-finance-truth.mjs");
const policyCheck = readText("scripts/check-policy-as-code.mjs");

checkPositiveGoldenChain();
checkNegativeDefinitionAdmissionEvidence();
checkNegativeMigrationIdentity();
checkNegativeReadSideAndFinance();

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory golden chain tests check: PASS");

function checkPositiveGoldenChain() {
  const mainFlow = section(scenario, "mainFlow");
  const workItems = [...mainFlow.matchAll(/workItemType:\s*([^\n\r]+)/g)].map((match) => match[1].trim());
  requireValue(JSON.stringify(workItems) === JSON.stringify(positiveChain.map((item) => item[0])), "golden_chain.main_flow", "第一金链正向路径必须是 RoomSetupConfirm -> BedSetupConfirm -> ResourceReadinessConfirm。");

  for (const [workItemType, definitionId, commandType] of positiveChain) {
    const sourceItem = (kernel.workItems ?? []).find((item) => item.workItemType === workItemType);
    const generatedItem = (generatedWorkitems.workItems ?? []).find((item) => item.workItemType === workItemType);
    const definition = (definitions.definitions ?? []).find((item) => item.definitionId === definitionId);
    const workflow = (workflows.workflows ?? []).find((item) => item.definitionId === definitionId);
    requireValue(Boolean(sourceItem), "golden_chain.source_missing", `${workItemType} 必须存在于 Source kernel。`);
    requireValue(Boolean(generatedItem), "golden_chain.generated_missing", `${workItemType} 必须存在于 generated workitems。`);
    requireValue(Boolean(definition), "golden_chain.definition_missing", `${definitionId} 必须存在于 Definition Registry。`);
    requireValue(Boolean(workflow), "golden_chain.workflow_missing", `${definitionId} 必须存在于 workflow registry。`);
    if (sourceItem) {
      requireValue(sourceItem.definitionId === definitionId && sourceItem.commandType === commandType, "golden_chain.source_identity_mismatch", `${workItemType} Source identity 不一致。`);
      requireValue(sourceItem.ledgerPolicyRef === "ledger.none.v1", "golden_chain.ledger_none", `${workItemType} 必须 ledger.none.v1。`);
      requireValue(!("sourceCardId" in sourceItem), "golden_chain.source_card_current_identity", `${workItemType} Source 不得有顶层 sourceCardId。`);
    }
    if (definition) {
      requireValue(definition.commandType === commandType && definition.workItemType === workItemType, "golden_chain.definition_identity_mismatch", `${definitionId} identity 不一致。`);
      requireValue(!("sourceCardId" in definition), "golden_chain.definition_source_card", `${definitionId} 不得有顶层 sourceCardId。`);
    }
    if (workflow) {
      requireValue(workflow.commandType === commandType && workflow.workItemType === workItemType, "golden_chain.workflow_identity_mismatch", `${definitionId} workflow identity 不一致。`);
      requireValue(!("sourceCardId" in workflow), "golden_chain.workflow_source_card", `${definitionId} workflow 不得有顶层 sourceCardId。`);
    }
  }

  const policies = generatedWorkitems.transitionPolicy ?? [];
  requireValue(policies.some((item) => item.fromDefinitionId === "definition.dormitory.roomSetupConfirm.v1" && item.toDefinitionId === "definition.dormitory.bedSetupConfirm.v1"), "golden_chain.transition_room_to_bed", "generated transition 缺少 Room -> Bed。");
  requireValue(policies.some((item) => item.fromDefinitionId === "definition.dormitory.bedSetupConfirm.v1" && item.toDefinitionId === "definition.dormitory.resourceReadinessConfirm.v1"), "golden_chain.transition_bed_to_readiness", "generated transition 缺少 Bed -> ResourceReadiness。");
}

function checkNegativeDefinitionAdmissionEvidence() {
  const resolveIndex = canonicalSource.indexOf("var definition = definitions.Resolve(workItem);");
  const unresolvedIndex = canonicalSource.indexOf("if (!definition.Resolved)");
  const admissionIndex = canonicalSource.indexOf("admission.EvaluateConfirm");
  const commitIndex = canonicalSource.indexOf("unitOfWork.Commit(command)");
  requireValue(resolveIndex >= 0 && resolveIndex < unresolvedIndex && unresolvedIndex < admissionIndex && admissionIndex < commitIndex, "negative.missing_definition_gate", "缺 definition 必须在 admission/UOW 前 422。");
  requireValue((dbProof.rejectedPaths ?? []).includes("unresolved definition"), "negative.missing_definition_proof", "DB no-side-effects proof 必须覆盖缺 definition。");
  requireValue((dbProof.rejectedPaths ?? []).includes("missing evidence"), "negative.missing_evidence_proof", "DB no-side-effects proof 必须覆盖缺 evidence。");
  requireValue(policyCheck.includes("missing_required_evidence"), "negative.missing_evidence_policy", "Policy-as-code 必须有缺 evidence negative test。");
  requireValue(canonicalSource.includes("AdmissionRejected") && admissionIndex < commitIndex, "negative.missing_admission_gate", "缺 admission/准入拒绝必须在 UOW 前返回。");
}

function checkNegativeMigrationIdentity() {
  requireValue(!canonicalSource.includes("definitions.Resolve(workItem, normalized.CardId)"), "negative.card_id_resolve", "Confirm 不得从 cardId resolve definition。");
  requireValue(!canonicalSource.includes("[\"sourceCardId\"]"), "negative.source_card_trace", "Confirm payload 不得写顶层 sourceCardId。");
  for (const mapping of canonical.mappings ?? []) {
    requireValue(!("sourceCardId" in mapping), "negative.canonical_source_card", `${mapping.scenarioId} canonical mapping 不得有顶层 sourceCardId。`);
    requireMigrationRef(mapping, `canonical ${mapping.scenarioId}`);
  }
  for (const definition of definitions.definitions ?? []) {
    if (definition.definitionMode !== "oam-certification-current") continue;
    requireValue(!("sourceCardId" in definition), "negative.definition_source_card", `${definition.definitionId} 不得有顶层 sourceCardId。`);
    requireMigrationRef(definition, definition.definitionId);
  }
}

function checkNegativeReadSideAndFinance() {
  requireValue(dashboardCheck.includes("Dashboard business fact write must fail") && dashboardCheck.includes("Dashboard inline confirm must fail"), "negative.dashboard_write_fact", "Dashboard 写事实/inline confirm negative test 必须存在。");
  requireValue(searchCheck.includes("writeThroughSearchAllowed") && searchCheck.includes("writeBusinessFactAllowed"), "negative.search_write_fact", "Search 写事实 negative gate 必须存在。");
  requireValue(surfaceCheck.includes("writeBusinessFactAllowed") && surfaceCheck.includes("normalizeStructuredToken") && surfaceCheck.includes("productionAllowed"), "negative.surface_inferred_field", "Surface 推断字段/写事实 negative gate 必须存在。");
  requireValue(financeCheck.includes("directLedgerEntryMutationAllowed: false") && financeTruthCheck.includes("finance_truth.direct_fact_commit"), "negative.non_finance_ledger", "非 finance kernel 写 LedgerEntry negative gate 必须存在。");
  requireValue(unitOfWorkSource.includes("operations_handler_ledger_truth_owner_not_allowed"), "negative.unit_of_work_ledger_owner", "UOW 必须拒绝非 MoneyKernelPack LedgerEntry。");
}

function requireMigrationRef(item, label) {
  const ref = (item.migrationRefs ?? []).find((candidate) => candidate.type === "sourceCardId");
  requireValue(Boolean(ref), "negative.migration_ref_missing", `${label} 必须仅用 migrationRefs 保留 sourceCardId。`);
  if (!ref) return;
  requireValue(ref.readOnly === true && ref.executable === false && ref.affectsAdmission === false && ref.affectsRuntimeConfirm === false && ref.affectsBusinessIdentity === false && ref.affectsLedger === false, "negative.migration_ref_policy", `${label} migrationRefs.sourceCardId 必须只读且不影响 admission/runtime/business identity/ledger。`);
}

function section(text, name) {
  const pattern = new RegExp(`^${escapeRegExp(name)}:\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const rest = text.slice(match.index + match[0].length);
  const next = /\n[A-Za-z0-9_.-]+:\s*/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireValue(condition, id, message) {
  if (!condition) violations.push({ id, severity: "P0", message });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-golden-chain-tests.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    positiveChain: positiveChain.map(([workItemType, definitionId, commandType]) => ({ workItemType, definitionId, commandType })),
    negativeTests: [
      "missing definition",
      "missing admission",
      "missing evidence",
      "cardId/sourceCardId overreach",
      "Dashboard write fact",
      "Search write fact",
      "Surface inferred/write fact",
      "non-finance LedgerEntry"
    ],
    violations
  }, null, 2)}\n`);
}
