import {
  failIfViolations,
  includesAll,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  validateSchemaFile,
  violation
} from "./lib/oam02-semantic-lib.mjs";

const checkId = "scenario-field-contract";
const scannedFiles = [
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "schemas/business/scenario-field-contract.schema.json"
];
const contract = readJson(scannedFiles[0]);
const scenarioPack = readJson(scannedFiles[1]);
const violations = [
  ...validateSchemaFile(scannedFiles[2], ["$schema", "$id", "required", "properties"])
];

requireValue(contract.productionAllowed === false, violations, "scenario.production_allowed", "场景字段合同不得允许 production。");
requireValue(contract.domain === "dormitory", violations, "scenario.domain_mismatch", "场景字段合同 domain 必须是 dormitory。");

const fieldSets = contract.fieldSets ?? [];
const fieldByScenario = indexBy(fieldSets, "scenarioId");
const scenariosById = indexBy(scenarioPack.scenarios ?? [], "scenarioId");
const expectedFailureCases = [
  "same_submission_dual_state_409",
  "evidence_resolved_but_workitem_blocked_422",
  "refund_balanced_wrong_deposit_account"
];

for (const scenarioId of requiredScenarioIds) {
  const scenario = scenariosById.get(scenarioId);
  const fields = fieldByScenario.get(scenarioId);
  requireValue(Boolean(scenario), violations, "scenario.source_missing", `源场景缺少 ${scenarioId}。`, { scenarioId });
  requireValue(Boolean(fields), violations, "scenario.field_set_missing", `场景字段合同缺少 ${scenarioId}。`, { scenarioId });
  if (!scenario || !fields) continue;

  requireValue(fields.workItemType === scenario.workItemType, violations, "scenario.workitem_mismatch", `${scenarioId} 的 workItemType 与源场景不一致。`, { scenarioId });
  for (const key of ["businessFields", "systemFields", "evidenceFields", "ledgerFields", "lensFields", "semanticAssertions"]) {
    requireValue(Array.isArray(fields[key]), violations, "scenario.field_array_missing", `${scenarioId}.${key} 必须是数组。`, { scenarioId, key });
  }
  requireValue((fields.businessFields ?? []).length > 0, violations, "scenario.business_fields_missing", `${scenarioId} 缺少 businessFields。`, { scenarioId });
  requireValue((fields.systemFields ?? []).includes("workItemId"), violations, "scenario.workitem_id_missing", `${scenarioId} systemFields 必须包含 workItemId。`, { scenarioId });
  requireValue((fields.lensFields ?? []).length > 0, violations, "scenario.lens_fields_missing", `${scenarioId} 缺少 lensFields。`, { scenarioId });
  const missingEvidence = includesAll(fields.evidenceFields, scenario.requiredEvidence ?? []);
  for (const evidenceId of missingEvidence) {
    violations.push(violation("scenario.required_evidence_missing", `${scenarioId} evidenceFields 未覆盖源场景证据 ${evidenceId}。`, { scenarioId, evidenceId }));
  }
  if (scenario.moneyCommand && scenario.scenarioType === "committed_scenario") {
    requireValue((fields.ledgerFields ?? []).includes("ledgerTransactionId"), violations, "scenario.money_ledger_fields_missing", `${scenarioId} 金额场景必须包含 ledgerTransactionId。`, { scenarioId });
  }
  if (scenario.scenarioType === "rejected_command_scenario") {
    requireValue((fields.systemFields ?? []).some((field) => field.includes("rejectedSubmissionId")), violations, "scenario.rejection_submission_missing", `${scenarioId} rejected 场景必须包含 rejectedSubmissionId。`, { scenarioId });
  }
}

const failureIds = (contract.semanticFailureCases ?? []).map((item) => item.id);
for (const expected of expectedFailureCases) {
  requireValue(failureIds.includes(expected), violations, "scenario.failure_case_missing", `缺少 P0 语义失败用例 ${expected}。`, { expected });
}

failIfViolations(checkId, violations, scannedFiles);
