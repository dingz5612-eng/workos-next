import {
  failIfViolations,
  includesAll,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  validateSchemaFile,
  violation
} from "./lib/oam-business-semantic-lib.mjs";

const checkId = "evidence-coverage-contract";
const scannedFiles = [
  "docs/business/dormitory/evidence-coverage-contract.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/workitem-decision-table.json",
  "docs/business/dormitory/evidence-policy.yml",
  "docs/business/dormitory/evidence-requirements.yml",
  "schemas/business/evidence-coverage-contract.schema.json"
];
const contract = readJson(scannedFiles[0]);
const fields = indexBy(readJson(scannedFiles[1]).fieldSets ?? [], "scenarioId");
const scenarios = indexBy(readJson(scannedFiles[2]).scenarios ?? [], "scenarioId");
const catalog = indexBy(readJson(scannedFiles[3]).workItems ?? [], "workItemType");
const decisions = indexBy(readJson(scannedFiles[4]).decisions ?? [], "workItemType");
const policy = readJson(scannedFiles[5]);
const requirements = indexBy(readJson(scannedFiles[6]).evidenceRequirements ?? [], "requirementId");
const policyById = indexBy(policy.requirements ?? [], "requirementId");
const violations = [
  ...validateSchemaFile(scannedFiles[7], ["$schema", "$id", "required", "properties"])
];

requireValue(contract.productionAllowed === false, violations, "evidence.production_allowed", "证据覆盖合同不得允许 production。");
for (const flag of ["missingEvidenceBlocksConfirm", "rejectedEvidenceBlocksConfirm", "wrongScopeEvidenceBlocksConfirm"]) {
  requireValue(contract.runtimeFlags?.[flag] === true && policy[flag] === true, violations, "evidence.runtime_flag_missing", `${flag} 必须在合同和 runtime policy 中同时为 true。`, { flag });
}

for (const scenarioId of requiredScenarioIds) {
  const scenario = scenarios.get(scenarioId);
  const fieldSet = fields.get(scenarioId);
  const catalogItem = catalog.get(scenario?.workItemType);
  if (!scenario || !fieldSet) continue;
  const decision = decisions.get(scenario.workItemType);
  requireValue(Boolean(decision), violations, "evidence.scenario_decision_missing", `${scenario.workItemType} 缺少宿舍动作裁决。`, { scenarioId, workItemType: scenario.workItemType });
  requireValue(decision?.definitionRequired === true, violations, "evidence.scenario_not_executable", `${scenario.workItemType} 必须是需要 Definition 的当前动作或财务治理动作。`, { scenarioId, workItemType: scenario.workItemType });
  const expectedEvidence = Array.from(new Set([...(scenario.requiredEvidence ?? []), ...(fieldSet.evidenceFields ?? [])]));
  for (const evidenceId of expectedEvidence) {
    requireValue(Boolean(policyById.get(evidenceId)), violations, "evidence.policy_missing_scenario_requirement", `${scenarioId} 的证据 ${evidenceId} 未进入 evidence-policy。`, { scenarioId, evidenceId });
    requireValue(Boolean(requirements.get(evidenceId)), violations, "evidence.required_fields_missing", `${evidenceId} 未进入 evidence-requirements。`, { scenarioId, evidenceId });
  }
  if (decision?.keepInDormitoryCatalog === true) {
    const missingInCatalog = includesAll(catalogItem?.requiredEvidence ?? [], scenario.requiredEvidence ?? []);
    for (const evidenceId of missingInCatalog) {
      violations.push(violation("evidence.catalog_missing_scenario_requirement", `${scenario.workItemType} catalog 未覆盖场景证据 ${evidenceId}。`, { scenarioId, workItemType: scenario.workItemType, evidenceId }));
    }
  } else {
    requireValue(decision?.decision === "externalFinanceGovernance", violations, "evidence.non_catalog_not_external_finance", `${scenario.workItemType} 不在宿舍 catalog 时只能是财务治理动作。`, { scenarioId, workItemType: scenario.workItemType });
  }
}

for (const requirement of policy.requirements ?? []) {
  requireValue(Boolean(requirements.get(requirement.requirementId)), violations, "evidence.policy_requirement_fields_missing", `${requirement.requirementId} 在 policy 中存在但缺少 requiredFields。`, { requirementId: requirement.requirementId });
  for (const workItemType of requirement.workItemTypes ?? []) {
    if (workItemType.startsWith("Gate.")) continue;
    const decision = decisions.get(workItemType);
    requireValue(Boolean(decision), violations, "evidence.policy_workitem_missing_decision", `${workItemType} 在 evidence-policy 中存在但缺少裁决。`, { workItemType });
    if (decision?.keepInDormitoryCatalog === true) {
      requireValue(Boolean(catalog.get(workItemType)), violations, "evidence.policy_workitem_missing_catalog", `${workItemType} 裁决为宿舍当前动作但缺少 catalog 项。`, { workItemType });
    } else {
      requireValue(decision?.decision === "externalFinanceGovernance", violations, "evidence.policy_non_current_workitem", `${workItemType} 不是宿舍当前动作或财务治理动作，不得挂 evidence-policy。`, { workItemType });
    }
  }
}

failIfViolations(checkId, violations, scannedFiles);
